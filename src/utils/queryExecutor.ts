/* eslint-disable @typescript-eslint/no-unused-vars */
import { Connection } from '@jsforce/jsforce-node';
import SFPLogger, {LoggerLevel } from '@flxbl-io/sfp-logger';
import retry from 'async-retry';

export default class QueryExecutor {
    constructor(private conn: Connection) {}

    public async executeQuery(query: string, tooling: boolean) {
        return await retry(
            async () => {
                try {
                    // First try normal query
                    return await this.executeNormalQuery(query, tooling);
                } catch (error) {
                    // If we get a header size error, fallback to bulk query
                    if (error.message?.includes('431') || error.message?.includes('Request Header Fields Too Large')) {
                        return await this.executeBulkQuery(query);
                    }
                    throw error;
                }
            },
            {
                retries: 5,
                minTimeout: 2000,
                onRetry: (error) => {
                    SFPLogger.log(`Retrying Network call due to ${error.message}`, LoggerLevel.INFO);
                },
            }
        );
    }

    private async executeNormalQuery(query: string, tooling: boolean) {
        let results;

        if (tooling) {
            results = (await this.conn.tooling.query(query)) as any;
        } else {
            results = (await this.conn.query(query)) as any;
        }

        if (!results.done) {
            let tempRecords = results.records;
            while (!results.done) {
                results = await this.queryMore(results.nextRecordsUrl, tooling);
                tempRecords = tempRecords.concat(results.records);
            }
            results.records = tempRecords;
        }

        return results.records;
    }

    private async executeBulkQuery(query: string): Promise<any> {
        try {
            // Extract object type from query
            const objectType = this.getObjectTypeFromQuery(query);

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const queryResult = await (await this.conn.bulk2.query(query)).toArray();

            // Transform results to match REST API format
            return queryResult.map((record: any) => ({
                attributes: {
                    type: objectType,
                    url: `/services/data/v${this.conn.version}/sobjects/${objectType}/${record.Id}`
                },
                ...record
            }));
        } catch (error) {
            throw new Error(`Bulk query failed: ${error.message}`);
        }
    }

    private getObjectTypeFromQuery(query: string): string {
        const matches = query.match(/FROM\s+([a-zA-Z0-9_]+)/i);
        if (!matches || !matches[1]) {
            throw new Error('Unable to determine object type from query');
        }
        return matches[1];
    }

    public async queryMore(url: string, tooling: boolean) {
        let result;
        if (tooling) {
            result = (await this.conn.tooling.queryMore(url)) as any;
        } else {
            result = (await this.conn.queryMore(url)) as any;
        }
        return result;
    }
}
