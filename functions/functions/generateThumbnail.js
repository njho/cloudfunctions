const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
const admin = require('firebase-admin');


exports.handler = (event) => {
    // [END generateThumbnailTrigger]
    // [START eventAttributes]
    const object = event.data; // The Storage object.
    console.log(object);
    const journey_id = object.name.substring(0, object.name.indexOf('/'));
    const photo_uid = object.name.substring(object.name.indexOf('/')+1, object.name.length-4);
    console.log(journey_id);
    console.log(photo_uid);


    const fileBucket = object.bucket; // The Storage bucket that contains the file.
    const filePath = object.name; // File path in the bucket.
    const contentType = object.contentType; // File content type.
    const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
    const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.
    // [END eventAttributes]

    // [START stopConditions]
    // Exit if this is triggered on a file that is not an image.
    if (!contentType.startsWith('image/')) {
        console.log('This is not an image.');
        return null;
    }

    // Get the file name.
    const fileName = path.basename(filePath);
    // Exit if the image is already a thumbnail.
    if (fileName.startsWith('thumb_') || fileName.startsWith('journey_')) {
        console.log('Image has already been handled: ');
        return null;
    }

    // Exit if this is a move or deletion event.
    if (resourceState === 'not_exists') {
        console.log('This is a deletion event.');
        return null;
    }

    // Exit if file exists but is not new and is only being triggered
    // because of a metadata change.
    if (resourceState === 'exists' && metageneration > 1) {
        console.log('This is a metadata change event.');
        return null;
    }
    // [END stopConditions]

    // [START thumbnailGeneration]
    // Download file from bucket.
    const bucket = gcs.bucket(fileBucket);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const metadata = {
        contentType: contentType,
    };


    return bucket.file(filePath).download({
        destination: tempFilePath,
    }).then(() => {
        console.log('Image downloaded locally to', tempFilePath);
        console.log(tempFilePath);

        // Rotate Image using ImageMagick.
        return spawn('convert', [tempFilePath, '-auto-orient', tempFilePath]);
    }).then(() => {
        console.log('AutoOriented Image created at', tempFilePath);
        // Uploading the thumbnail.
        const handledFileName = `journey_${fileName}`;
        const handledFilePath = path.join(path.dirname(filePath), handledFileName);

        return bucket.upload(tempFilePath, {
            destination: handledFilePath,
            metadata: metadata,
        });
        // Once the thumbnail has been uploaded delete the local file to free up disk space.
    })
    //     .then(() => {
    //     console.log('Generating a thumbnail');
    //     // Generate a thumbnail using ImageMagick.
    //     return spawn('convert', [tempFilePath, '-thumbnail', '200x200', tempFilePath]);
    // }).then(() => {
    //     console.log('Thumbnail created at', tempFilePath);
    //     // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
    //     const thumbFileName = `thumb_${fileName}`;
    //     const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
    //     // Uploading the thumbnail.
    //     return bucket.upload(tempFilePath, {
    //         destination: thumbFilePath,
    //         metadata: metadata,
    //     });
    //     // Once the thumbnail has been uploaded delete the local file to free up disk space.
    // })

        .then(()=> {
        console.log('All Image Transformations Successful, delete the existing');
        return bucket.file(filePath).delete()
    }).then(()=>{
        console.log('Changing status of image availability in Firebase');
        console.log(object.metadata.uid)
        return admin.database().ref('/live_journeys/' + journey_id).child(photo_uid).child('imageUploaded').set(true)
        }).then(() => {fs.unlinkSync(tempFilePath)});

    // [END thumbnailGeneration]


}