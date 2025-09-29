"use server";

import { getCollection } from "@/lib/db";
import {
  ChallengeDataType,
  MembershipsDataType,
  UserIdsDataType,
} from "@/types/dbTypes";
import { FindOptions, ObjectId } from "mongodb";

export type LeaderboardEntryType = {
  _id: string;
  name: string;
  entityId: string;
  country: string;
  competitionId: string;
  amount: number;
  activePoints: number;
  averagePoints?: number;
  rankQuantityForActivePoints?: number;
};

export type LeaderboardAPIResponse = {
  leaderboard?: LeaderboardEntryType[];
  error?: string;
  blockAccess?: boolean;
};

export type LeaderboardPositionResponse = {
  activePoints?: number;
  averagePoints?: number;
  rankQuantityForActivePoints?: number;
};

const queryParamsToString = (params: any) => {
  return Object.keys(params)
    .map((key) => `${key}=${params[key]}`)
    .join("&");
};

export const getActiveChallenge = async () => {
  const challenges = await getCollection("challenges");
  const projection: FindOptions["projection"] = {
    endDate: 1,
    startDate: 1,
    challengeId: 1,
    active: 1,
  };

  const challengeData = (await challenges.findOne(
    { active: true },
    { projection }
  )) as ChallengeDataType;
  if (!challengeData) {
    console.log("No active challenge found.");
    return "";
  }
  // console.log("Active challengeId:", challengeData.challengeId);
  return challengeData.challengeId;
};

export const getSchoolIdFromSchoolCode = async (
  challengeId: string,
  schoolCode: string
) => {
  const challengeCodes = await getCollection("challengeCodes");
  const challengeSchool = await challengeCodes.findOne({
    challengeId,
    schoolCode,
  });
  // console.log("getSchoolIdFromSchoolCode - school:", challengeSchool);
  return challengeSchool?.schoolId || "";
};

export const checkIfUserHasSchoolCode = async (
  userId: string,
  challengeId: string
) => {
  const users = await getCollection("users");
  const userObject = await users.findOne({ "services.itza_auth.id": userId });

  // console.log("checkIfUserHasSchoolCode - userObject:", userObject);
  return userObject?.schoolCodes && challengeId
    ? userObject?.schoolCodes[challengeId]
    : "";
};

export const getUserMeteorId = async (id: string) => {
  const userIds = await getCollection("userids");
  const userIdsData = (await userIds.findOne({
    sa_id: id,
  })) as UserIdsDataType;

  return userIdsData?.meteor_id;
};

export const getLeaderboard = async (
  entityId: string,
  entityType: string,
  level: string
) => {
  let meteor_id;

  // console.log("getLeaderboard - entityIdToPass:", entityId);
  if (entityType === "user") {
    meteor_id = await getUserMeteorId(entityId);
  }

  const entityIdToPass = entityType === "user" ? meteor_id : entityId;
  const isObjectIdUser = entityType === "user" && typeof meteor_id !== "string";

  const competitionId = entityIdToPass && (await getActiveChallenge());

  const queryParams = {
    competitionId,
    entityId: entityIdToPass,
    level,
    leaderboardType: "absolute",
    currency: "challengePoints",
    leaderboardSize: 400,
    entityType,
    isObjectIdUser,
  };

  const baseURL = process.env.REALM_HTTPS_ENDPOINT as string;
  const endpointSecret = process.env.REALM_HTTPS_SECRET as string;
  const leaderboardsURL = `${baseURL}leaderboards?secret=${endpointSecret}&${queryParamsToString(queryParams)}`;
  // console.log("leaderboardsURL:", leaderboardsURL);

  const res = (await fetch(leaderboardsURL).catch((err) =>
    console.log(`There was an error fetching leaderboard data: ${err}`)
  )) as Response;

  if (!res.ok) {
    console.log("Something went wrong retrieving the leaderboard.");
    return false;
  }

  const leaderboardData = (await res.json()) as LeaderboardAPIResponse;
  // console.log("leaderboardData returned:", leaderboardData);
  if (
    !leaderboardData ||
    leaderboardData?.error ||
    leaderboardData?.blockAccess ||
    leaderboardData?.leaderboard?.length === 0
  ) {
    console.log("Something went wrong retrieving the leaderboard.");
    return false;
  }

  return leaderboardData;
};

export const getLeaderboardPosition = async (
  entityId: string,
  entityType: string,
  level: string
) => {
  let meteor_id;

  if (entityType === "user") {
    meteor_id = await getUserMeteorId(entityId);
  }

  const entityIdToPass = entityType === "user" ? meteor_id : entityId;
  const isObjectIdUser = entityType === "user" && typeof meteor_id !== "string";

  // const memberships = await getCollection("memberships");
  // const membershipsData = (await memberships.findOne({
  //   entityId: entityIdToPass,
  // })) as MembershipsDataType;

  // const competitionPair: [string, { active: boolean }] | undefined =
  //   Object.entries(membershipsData.competitions).find(
  //     (entry) => entry[1].active === true
  //   );

  const competitionId = (await getActiveChallenge()) || "WWGC_2024";
  // console.log("Position competitionId:", competitionId);
  const queryParams = {
    competitionId,
    entityId: entityIdToPass,
    entityType,
    level,
    isObjectIdUser,
  };

  const baseURL = process.env.REALM_HTTPS_ENDPOINT as string;
  const endpointSecret = process.env.REALM_HTTPS_SECRET as string;
  const leaderboardsPositionURL = `${baseURL}leaderboardsPosition?secret=${endpointSecret}&${queryParamsToString(queryParams)}`;
  // console.log("leaderboardsPositionURL:", leaderboardsPositionURL);

  const res = (await fetch(leaderboardsPositionURL).catch((err) =>
    console.log(`There was an error fetching leaderboard position data: ${err}`)
  )) as Response;

  if (!res.ok) {
    console.log(
      "Something went wrong retrieving the leaderboard position and score."
    );
    return [];
  }

  // console.log("res", res);
  const positionResponse = (await res.json()) as LeaderboardPositionResponse;

  if (Object.keys(positionResponse).length === 0) {
    console.log(
      "Something went wrong retrieving the leaderboard position and score.  Values set to 0."
    );
    positionResponse.activePoints = 0;
    positionResponse.averagePoints = 0;
    positionResponse.rankQuantityForActivePoints = 0;
  }

  // console.log("getLeaderboardPosition - positionResponse:", positionResponse);

  return positionResponse;
};

export const getMeteorUserId = async (sa_id: string) => {
  const userIDs = await getCollection("userids");
  const userId = await userIDs.findOne({ sa_id });
  return { meteorId: userId?.meteor_id, sa_id, username: userId?.sa_username };
};

export const getUserChallengePoints = async (
  meteorId: string,
  competitionId: string
) => {
  const challengePointsCollection = await getCollection(
    "challengePointAccounts"
  );
  const userChallengeData = await challengePointsCollection.findOne({
    entityId: meteorId,
    competitionId: competitionId,
  });

  // console.log(
  //   "%c getUserChallengePoints userChallengeData:",
  //   "color: gold",
  //   meteorId,
  //   competitionId,
  //   userChallengeData,
  // );
  // return 2000;
  // return 5001;
  return userChallengeData?.activePoints;
};

export async function getSchoolCodeForUser(sa_id: string, challengeId: string) {
  const users = await getCollection("users");
  const result = await users.findOne(
    { "services.itza_auth.id": sa_id },
    { projection: { [`schoolCodes.${challengeId}`]: 1 } }
  );
  return result;
}

export const getSchoolNameFromCode = async (schoolCode: string) => {
  const schools = await getCollection("schools");
  const schoolName = await schools.findOne(
    { schoolCode },
    { projection: { name: 1 } }
  );
  // console.log("getSchoolName schoolDetails:", schoolName);
  return schoolName?.name || "";
};
