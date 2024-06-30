import { Connection } from '@jsforce/jsforce-node';
import { delay } from './delay';
import SFPLogger, {LoggerLevel } from '@flxbl-io/sfp-logger';
import { RetrieveResult } from '@salesforce/source-deploy-retrieve';


export async function checkRetrievalStatus(conn: Connection, retrievedId: string, isToBeLoggedToConsole = true): Promise<RetrieveResult> {
    let metadata_result;

    while (true) {
        try {
            metadata_result = await conn.metadata.checkRetrieveStatus(retrievedId);
        } catch (error) {
            throw new Error(error.message);
        }

        if (metadata_result.done === 'false') {
            if (isToBeLoggedToConsole) SFPLogger.log(`Polling for Retrieval Status`, LoggerLevel.INFO);
            await delay(5000);
        } else {
            //this.ux.logJson(metadata_result);
            break;
        }
    }
    return metadata_result;
}
