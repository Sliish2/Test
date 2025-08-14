"use client";

NEWTEST

import React, { useState } from "react";
import { LeaderboardEntryType } from "../actions";
import { DevLeaderboardRow } from "@/devlink/DevLeaderboardRow";
import LeaderboardPosition from "./LeaderboardPosition";

import styles from "../leaderboards.module.scss";
import LeaderbordTablePagination from "./LeaderboardTablePagination";
import { DevLeaderboardRowActive } from "@/devlink";

type Props = {
  leaderboardData: LeaderboardEntryType[];
  leaderboardPositionData: LeaderboardEntryType;
  entityType: string;
  isMobile: boolean;
  userId: string;
};

const LeaderboardTable = ({
  leaderboardData,
  leaderboardPositionData,
  entityType,
  isMobile,
  userId,
}: Props) => {
  const ENTRIES_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const handlePagination = (pageNumber: number) => {
    // console.log("change page", pageNumber);
    setCurrentPage(pageNumber);
  };
  // console.log("leaderboardData", leaderboardData);
  const equalisedPositionData =
    leaderboardData && Array.isArray(leaderboardData)
      ? processEqualPlaces(leaderboardData, entityType)
      : [];
  const pageStart = (currentPage - 1) * ENTRIES_PER_PAGE;
  const pageEnd = currentPage * ENTRIES_PER_PAGE;

  //console.log("leaderboardData", leaderboardData);
  const indexWithinTable = leaderboardData.findIndex(
    (data) => data.entityId === userId
  );
  return (
    <div className={styles.table}>
      <LeaderboardPosition
        leaderboardPositionData={leaderboardPositionData}
        entityType={entityType}
        positionWithinTable={equalisedPositionData[indexWithinTable]}
      />
      {leaderboardData
        .slice(pageStart, pageEnd)
        .map((leaderboardEntry: LeaderboardEntryType, index: number) => {
          const overallIndex = index + pageStart;
          return (
            <>
              {leaderboardEntry.entityId !== userId && (
                <DevLeaderboardRow
                  key={index}
                  position={equalisedPositionData[overallIndex]}
                  points={
                    entityType === "user"
                      ? leaderboardEntry.activePoints
                      : leaderboardEntry.averagePoints
                  }
                  name={leaderboardEntry.name}
                  flag={`https://cdn.itza.world/itza-new-flags/${leaderboardEntry.country && leaderboardEntry.country.toLocaleLowerCase()}.png`}
                  showAvatar={!isMobile && entityType !== "school"}
                />
              )}
              {leaderboardEntry.entityId === userId && (
                <DevLeaderboardRowActive
                  key={index}
                  position={equalisedPositionData[overallIndex]}
                  points={
                    entityType === "user"
                      ? leaderboardEntry.activePoints
                      : leaderboardEntry.averagePoints
                  }
                  name={leaderboardEntry.name}
                  flag={`https://cdn.itza.world/itza-new-flags/${leaderboardEntry.country && leaderboardEntry.country.toLocaleLowerCase()}.png`}
                  showAvatar={!isMobile && entityType !== "school"}
                />
              )}
            </>
          );
        })}
      <LeaderbordTablePagination
        length={leaderboardData.length}
        entriesPerPage={20}
        handlePagination={handlePagination}
        currentPage={currentPage}
      />
    </div>
  );
};

const processEqualPlaces = (
  data: LeaderboardEntryType[],
  entityType: string
) => {
  const equalisedPositionData = [] as Array<number>;
  const sortField = entityType === "user" ? "activePoints" : "averagePoints";
  const sortedData = data.sort(
    (a, b) => (b[sortField] as number) - (a[sortField] as number)
  );
  for (let i = 0; i < sortedData.length; i++) {
    if (i === 0) {
      equalisedPositionData[i] = 1; // The top score is always going to be position 1
    } else {
      if (sortedData[i][sortField] === sortedData[i - 1][sortField]) {
        equalisedPositionData[i] = equalisedPositionData[i - 1];
      } else {
        equalisedPositionData[i] = equalisedPositionData[i - 1] + 1;
      }
    }
  }
  //console.log("equalisedPositionData", equalisedPositionData);
  return equalisedPositionData;
};

export default LeaderboardTable;
