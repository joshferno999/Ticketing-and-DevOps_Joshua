import Asana from "asana";

interface AsanaEnv {
  ASANA_CLIENT_ID: string;
  ASANA_CLIENT_SECRET: string;
  ASANA_REDIRECT_URI: string;
}

export function createAsanaClientFactory(env: AsanaEnv) {
  function fromAccessToken(accessToken: string) {
    const client = new Asana.ApiClient();
    const token = client.authentications.token;
    if (token) {
      token.accessToken = accessToken;
    }

    return {
      client,
      tasks: new Asana.TasksApi(client),
      stories: new Asana.StoriesApi(client),
      users: new Asana.UsersApi(client),
      projects: new Asana.ProjectsApi(client),
      workspaces: new Asana.WorkspacesApi(client)
    };
  }

  function getAuthorizationUrl(state: string, scopes?: string[]) {
    const base = new URL("https://app.asana.com/-/oauth_authorize");
    base.searchParams.set("client_id", env.ASANA_CLIENT_ID);
    base.searchParams.set("redirect_uri", env.ASANA_REDIRECT_URI);
    base.searchParams.set("response_type", "code");
    base.searchParams.set("state", state);
    if (scopes && scopes.length > 0) {
      base.searchParams.set("scope", scopes.join(" "));
    }
    return base.toString();
  }

  return {
    fromAccessToken,
    getAuthorizationUrl
  };
}
