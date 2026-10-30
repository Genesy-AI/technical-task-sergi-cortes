import { Client, Connection } from '@temporalio/client'
import { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE } from './config'

let clientPromise: Promise<Client> | undefined

/**
 * Returns one Temporal client shared by all requests, connecting on first use.
 * A failed connection is forgotten, so the next request tries again instead of reusing the error.
 */
export function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Connection.connect({ address: TEMPORAL_ADDRESS })
      .then((connection) => new Client({ connection, namespace: TEMPORAL_NAMESPACE }))
      .catch((error) => {
        clientPromise = undefined
        throw error
      })
  }
  return clientPromise
}
