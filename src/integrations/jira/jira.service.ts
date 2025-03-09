import { Version3Client, Version3Models } from 'jira.js';
import { getApiKey, ApiKeyType } from '../../services/api.key.service';

let client: Version3Client | null = null;

const initializeClient = async (companyId: string) => {
  if (client) return client;

  const apiToken = await getApiKey(companyId, 'jira_api_token');
  const domain = await getApiKey(companyId, 'jira_domain');
  const email = await getApiKey(companyId, 'jira_email');

  if (!apiToken || !domain || !email) {
    throw new Error('Missing JIRA configuration. Please set JIRA_API_TOKEN, JIRA_DOMAIN, and JIRA_EMAIL.');
  }

  client = new Version3Client({
    host: `https://${domain}.atlassian.net/`,
    authentication: {
      basic: {
        email,
        apiToken
      }
    }
  });

  return client;
};

export const createJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    summary: string;
    description: string;
    projectKey: string;
    issueType?: string;
  }
) => {
  const client = await initializeClient(companyId);

  try {
    const newIssue = await client.issues.createIssue({
      fields: {
        summary: params.summary,
        issuetype: {
          name: params.issueType || 'Task'
        },
        project: {
          key: params.projectKey
        },
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  text: params.description,
                  type: 'text'
                }
              ]
            }
          ]
        }
      }
    });

    return { success: true, data: newIssue };
  } catch (error: any) {
    throw new Error(`Failed to create JIRA ticket: ${error?.message || 'Unknown error'}`);
  }
};

export const fetchJiraTickets = async (
  sessionId: string,
  companyId: string,
  params: {
    projectKey: string;
    maxResults?: number;
  }
) => {
  const client = await initializeClient(companyId);
  const maxResults = params.maxResults || 50;

  try {
    let startAt = 0;
    let allTickets: Version3Models.Issue[] = [];
    
    while (true) {
      const response = await client.issueSearch.searchForIssuesUsingJql({
        startAt,
        maxResults,
        jql: `project = ${params.projectKey}`
      });
      
      const issues = response.issues || [];
      if (!issues.length) {
        break;
      }
      
      allTickets = allTickets.concat(issues);
      startAt += maxResults;

      // If we've reached the requested limit, stop
      if (params.maxResults && allTickets.length >= params.maxResults) {
        allTickets = allTickets.slice(0, params.maxResults);
        break;
      }
    }
    
    return { success: true, data: allTickets };
  } catch (error: any) {
    throw new Error(`Failed to fetch JIRA tickets: ${error?.message || 'Unknown error'}`);
  }
};

export const getJiraTicketById = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
  }
) => {
  const client = await initializeClient(companyId);

  try {
    const issue = await client.issues.getIssue({
      issueIdOrKey: params.issueIdOrKey
    });
    
    return { success: true, data: issue };
  } catch (error: any) {
    throw new Error(`Failed to fetch JIRA ticket: ${error?.message || 'Unknown error'}`);
  }
};
