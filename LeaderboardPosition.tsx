import React from "react";
import { LeaderboardEntryType } from "../actions";

import styles from "../leaderboards.module.scss";

type Props = {
  leaderboardPositionData: LeaderboardEntryType;
  entityType?: string;
  positionWithinTable?: number;
};

const LeaderboardPosition = ({
  leaderboardPositionData,
  entityType = "user",
  positionWithinTable,
}: Props) => {
  const finalUserPosition = positionWithinTable
    ? positionWithinTable
    : leaderboardPositionData.rankQuantityForActivePoints;
  return (
    <div className={styles.positionContainer}>
      <div className={styles.positionInnerContainer}>
        <div className={styles.positionText}>
          Your {entityType === "school" && "School"} Position:
        </div>
        <div className={styles.positionBox}>{finalUserPosition}</div>
      </div>
      <div className={styles.positionInnerContainer}>
        <div className={styles.positionText}>
          Your {entityType === "school" && "School"} Points:
        </div>
        <div className={styles.positionBox}>
          {entityType === "user"
            ? leaderboardPositionData.activePoints
            : leaderboardPositionData.averagePoints}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPosition;
