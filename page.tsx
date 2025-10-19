import { auth } from "@/auth";
import LeaderboardsWrapper from "./components/LeaderboardsWrapper";

import styles from "./leaderboards.module.scss";
import ClickEventProvider from "@/components/ui/Header/ClickEventProvider";
import { getSchoolCodeConfig } from "@/components/ui/SchoolCodeModal/actions";
import { SchoolCodeModalFlow } from "@/components/ui/SchoolCodeModal/SchoolCodeModalFlow";

export default async function Home() {
  const session = await auth();

  return (
    <div className={styles.container}>
      <LeaderboardsWrapper session={session} />
    </div>
  );
}
