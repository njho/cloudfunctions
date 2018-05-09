const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
const admin = require('firebase-admin');
const ffmpeg = require('fluent-ffmpeg');
const ffmpeg_static = require('ffmpeg-static');

function promisifyCommand(command) {
    return new Promise((resolve, reject) => {
        command
            .on('end', () => {
                resolve();
            })
            .on('error', (error) => {
                reject(error);
            })
            .run();
    });
}

/**
 * Utility method to generate thumbnail using FFMPEG.
 */
function generateThumbnailAsync(tempFilePath, targetTempFilePath) {
    return new Promise((resolve, reject) => {
        const command = ffmpeg(tempFilePath)
            .setFfmpegPath(ffmpeg_static.path)
            .audioChannels(1)
            .audioFrequency(16000)
            .format('flac')
            .on('error', (err) => {
                console.log('An error occurred: ' + err.message);
                reject(err);
            })
            .on('end', () => {
                console.log('Output audio created at', targetTempFilePath);
            })
            .save(targetTempFilePath);
    });
}


exports.handler = (event) => {
    // [END generateThumbnailTrigger]
    // [START eventAttributes]
    const object = event.data; // The Storage object.
    console.log(object);
    const journey_id = object.name.substring(0, object.name.indexOf('/'));
    const photo_uid = object.name.substring(object.name.indexOf('/') + 1, object.name.length - 4);
    console.log(journey_id);
    console.log(photo_uid);


    const fileBucket = object.bucket; // The Storage bucket that contains the file.
    const filePath = object.name; // File path in the bucket.
    const contentType = object.contentType; // File content type.
    const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
    const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.

    //=================VIDEO THUMBNAIL HANDLING==================>
    const targetTempFileName = fileName.replace(/\.[^/.]+$/, '') + '_thumbnail.png';
    console.log('This is the Video Filename: ' + targetTempFileName);
    const targetTempFilePath = path.join(os.tmpdir(), targetTempFileName);
    const targetStorageFilePath = path.join(path.dirname(filePath), targetTempFileName);


    // [END eventAttributes]

    // [START stopConditions]
    // Exit if this is triggered on a file that is not an image or a video.
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
        console.log('This is not an image or a video.');
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

    if (contentType.startsWith('image/')) {
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

            .then(() => {
                console.log('All Image Transformations Successful, delete the existing');
                return bucket.file(filePath).delete()
            }).then(() => {
                console.log('Changing status of image availability in Firebase');
                console.log(object.metadata.uid)
                return admin.database().ref('/live_journeys/' + journey_id).child(photo_uid).update({
                    dataUploaded: true,
                    type: 'image'
                })
            }).then(() => {
                fs.unlinkSync(tempFilePath)
            });
    } else if (contentType.startsWith('video/')) {
        return bucket.file(filePath).download({
            destination: tempFilePath,
        }).then(() => {
            console.log('Video downloaded locally to', tempFilePath);

            let command = ffmpeg(tempFilePath)
                .setFfmpegPath(ffmpeg_static.path)
                .outputOptions('-vframes 1')
                .outputOptions('-f image2pipe')
                .outputOptions('-vcodec png')
                .output(targetTempFilePath);

            command = promisifyCommand(command);

            return command;

        }).then(() => {
            console.log('Video thumbnail created at: ', targetTempFilePath);
            // Uploading the video thumbnail.
            return bucket.upload(targetTempFilePath, {destination: targetStorageFilePath});
        }).then(() => {
            console.log('Output audio uploaded to', targetStorageFilePath);

            // Once the audio has been uploaded delete the local file to free up disk space.
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(targetTempFilePath);
            console.log('Temporary files removed.', targetTempFilePath);

            return admin.database().ref('/live_journeys/' + journey_id).child(photo_uid).update({
                dataUploaded: true,
                type: 'video'
            });
        }).then(() => {
            console.log('Video Tasks Completed!');
        })
    }

    // [END thumbnailGeneration]


}