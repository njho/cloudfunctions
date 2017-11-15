import { makeExecutableSchema } from "graphql-tools"

import resolvers from "./resolvers"

const schema = `
   type PublisherInfo {
        token: String
        session_id: String
    }

  type Query {
    requestToken(session_id: String!, user_id: String!,journey_id: String!, name: String! ): String
    createSession(journey_id: String!, journey_name: String!, user_id: String!, user_name: String!, journey_description: String!): PublisherInfo
  }
`

export default makeExecutableSchema({
    typeDefs: schema,
    resolvers
})