// Explicit PostgREST embed hints (avoids PGRST201 ambiguous relationship errors).

export const USER_WITH_TEAM_AND_DISPATCHER =
  "*, team:Team!User_teamId_fkey(name), dispatcher:Dispatcher!Dispatcher_userId_fkey(id), organization:Organization!User_organizationId_fkey(timezone, currency)";

export const USER_WITH_TEAM = "*, team:Team!User_teamId_fkey(name)";

export const DISPATCHER_WITH_USER_AND_TEAM =
  "*, user:User!Dispatcher_userId_fkey!inner(fullName, email, phoneNumber, role, supabaseUserId), team:Team!Dispatcher_teamId_fkey(name)";

export const CARRIER_WITH_RELATIONS =
  "*, team:Team!Carrier_teamId_fkey(name), dispatcher:Dispatcher!Carrier_dispatcherId_fkey(user:User!Dispatcher_userId_fkey(fullName))";

export const TEAM_WITH_LEAD =
  "*, teamLead:User!Team_teamLeadUserId_fkey(fullName)";
