import React from "react";

import styles from "../leaderboards.module.scss";
import Breadcrumb from "@/components/ui/Breadcrumb/Breadcrumb";
import { HeroSection } from "@/devlink/HeroSection";

type Props = {
  message: string;
  children: React.ReactNode;
  isMobile: boolean;
};

const LeaderboardMessagePrompt = ({ message, isMobile, children }: Props) => {
  return (
    <>
      <div className={styles.messageContainer}>
        <p className={styles.message}>{message}</p>
        {children}
      </div>
    </>
  );
};

export default LeaderboardMessagePrompt;
