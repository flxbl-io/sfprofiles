import { Connection } from '@jsforce/jsforce-node';
import { delay } from './delay';
import SFPLogger, {LoggerLevel } from '@flxbl-io/sfp-logger';
import { DeployResult } from '@salesforce/source-deploy-retrieve';

export async function checkDeploymentStatus(conn: Connection, retrievedId: string): Promise<DeployResult> {
    let metadata_result;

    while (true) {
        try {
            metadata_result = await conn.metadata.checkDeployStatus(retrievedId, true);
        } catch (error) {
                throw new Error(error.message);
        }

        if (!metadata_result.done) {
            SFPLogger.log('Polling for Deployment Status', LoggerLevel.INFO);
            await delay(5000);
        } else {
            break;
        }
    }
    return metadata_result;
}
