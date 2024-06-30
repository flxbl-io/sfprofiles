/* eslint-disable @typescript-eslint/no-unused-vars */
import getDefaults from '@utils/getDefaults';
import SFPLogger, {LoggerLevel } from '@flxbl-io/sfp-logger';
import { Connection } from '@jsforce/jsforce-node';
import { chunkArray } from '@utils/chunkArray';
// import { ProgressBar } from '../../../ui/progressBar';
import GetDefaults from '@utils/getDefaults';
import { isArray } from 'util';
import { DescribeMetadataResult, FileProperties } from '@jsforce/jsforce-node/lib/api/metadata';
const retry = require('async-retry');

export default class MetadataSummaryInfoFetcher {
    private static NotSupportedTypes = [
        'AccountForecastSettings',
        'Icon',
        'GlobalValueSet',
        'StandardValueSet',
        'CustomPermission',
        'EscalationRules',
        'RecordActionDeployment',
        'EscalationRule',
        'ApprovalProcess',
        'SiteDotCom',
        'BrandingSet',
        'NetworkBranding',
        'AuthProvider',
        'ContentAsset',
        'CustomSite',
        'EmbeddedServiceConfig',
        'UIObjectRelationConfig',
        'CareProviderSearchConfig',
        'EmbeddedServiceBranding',
        'EmbeddedServiceFlowConfig',
        'EmbeddedServiceMenuSettings',
        'SalesAgreementSettings',
        'ActionLinkGroupTemplate',
        'TransactionSecurityPolicy',
        'SynonymDictionary',
        'RecommendationStrategy',
        'UserCriteria',
        'ModerationRule',
        'CMSConnectSource',
        'FlowCategory',
        'Settings',
        'PlatformCachePartition',
        'LightningBolt',
        'LightningExperienceTheme',
        'LightningOnboardingConfig',
        'CorsWhitelistOrigin',
        'CustomHelpMenuSection',
        'Prompt',
        'Report',
        'Dashboard',
        'AnalyticSnapshot',
        'Role',
        'Group',
        'Community',
        'ChatterExtension',
        'PlatformEventChannel',
        'CommunityThemeDefinition',
        'CommunityTemplateDefinition',
        'NavigationMenu',
        'ManagedTopics',
        'ManagedTopic',
        'KeywordList',
        'InstalledPackage',
        'Scontrol',
        'Certificate',
        'LightningMessageChannel',
        'CaseSubjectParticle',
        'ExternalDataSource',
        'ExternalServiceRegistration',
        'Index',
        'CustomFeedFilter',
        'PostTemplate',
        'ProfilePasswordPolicy',
        'ProfileSessionSetting',
        'MyDomainDiscoverableLogin',
        'OauthCustomScope',
        'LeadConvertSettings',
        'DataCategoryGroup',
        'RemoteSiteSetting',
        'CspTrustedSite',
        'RedirectWhitelistUrl',
        'CleanDataService',
        'Skill',
        'ServiceChannel',
        'QueueRoutingConfig',
        'ServicePresenceStatus',
        'PresenceDeclineReason',
        'PresenceUserConfig',
        'EclairGeoData',
        'ChannelLayout',
        'CallCenter',
        'TimeSheetTemplate',
        'CanvasMetadata',
        'MobileApplicationDetail',
        'CustomNotificationType',
        'NotificationTypeConfig',
        'DelegateGroup',
        'ManagedContentType',
        'EmailServicesFunction',
        'SamlSsoConfig',
        'EmbeddedServiceLiveAgent',
    ];

    public static async fetchMetadataSummaryFromAnOrg(
        conn: Connection,
        isDisplayProgressBar = false,
        filterTypes: string[] = MetadataSummaryInfoFetcher.NotSupportedTypes
    ): Promise<Map<string, MetadataSummary>> {
        let metadataMap: Map<string, MetadataSummary> = new Map<string, MetadataSummary>();
        let types = [];

        let result: DescribeMetadataResult = await conn.metadata.describe(getDefaults.getApiVersion());

        result.metadataObjects.forEach((metadata) => {
            //Not supported .. ignore
            if (!this.NotSupportedTypes.includes(metadata.xmlName)) {
                types.push({ type: metadata.xmlName });
            }

            //Has childs.. check for each child and add to the list
            if (metadata.childXmlNames) {
                for (let childMetadata of metadata.childXmlNames) {
                    if (!this.NotSupportedTypes.includes(childMetadata)) {
                        types.push({ type: childMetadata });
                    }
                }
            }
        });

        SFPLogger.log(
            `Fetching ${types.length} Metadata Types From the Org `,
            LoggerLevel.INFO
        );


        //Fetch Summary Info in chunks of three
        for (let typesInChunk of chunkArray(3, types)) {
            try {
                metadataMap = await this.fetchMetadataSummaryByTypesFromAnOrg(conn, typesInChunk, metadataMap);
                // progressBar.increment(typesInChunk.length);
                SFPLogger.log(`Retrieved ${metadataMap.size} of ${types.length}`, LoggerLevel.INFO);
            } catch (error) {
                // TODO: Check message for typo
                if (error.message == 'Undefinded Metadata Type') {
                    SFPLogger.log(
                        `Unknown Types ${JSON.stringify(
                            typesInChunk
                        )} Encountered while retrieving types from the org, Please raise an issue!`,
                        LoggerLevel.WARN
                    );
                } else {

                    throw new Error(error);
                }
            }
        }

        SFPLogger.log(`Successfully retrieved ${metadataMap.size} Metadata Types. `)
        return metadataMap;
    }

    public static async fetchMetadataSummaryByTypesFromAnOrg(
        conn: Connection,
        types: any[],
        metadataMap: Map<string, MetadataSummary>
    ) {
        return await retry(
            async (bail) => {
                let results: FileProperties[] = await conn.metadata.list(types, GetDefaults.getApiVersion());

                if (!isArray(results)) {
                    throw new Error('Undefinded Metadata Type');
                }

                // if (results.length > 0)
                for (let result of results) {
                    metadataMap.set(result.id, {
                        id: result.id,
                        fullName: result.fullName,
                        type: result.type,
                    });
                }

                return metadataMap;
            },
            { retries: 3, minTimeout: 2000 }
        );
    }
}
export interface MetadataSummary {
    id: string;
    fullName: string;
    type: string;
}
