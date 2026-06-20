export type AccessScope = {
  teamIds: string[];
  carrierIds: string[];
};

export function getAccessScope(): AccessScope {
  return {
    teamIds: [],
    carrierIds: [],
  };
}
