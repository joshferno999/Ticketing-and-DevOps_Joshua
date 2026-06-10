import { extractAsanaTaskIds } from "@emergence-devops/shared";

export function createBridgeService() {
  function resolveAsanaTargets(input: string) {
    return extractAsanaTaskIds(input).taskGids;
  }

  return {
    resolveAsanaTargets
  };
}

