"use client";
import React, { useEffect, useState } from "react";
import {
  checkIfUserHasSchoolCode,
  getLeaderboard,
  getLeaderboardPosition,
  getActiveChallenge,
  getSchoolIdFromSchoolCode,
  getUserMeteorId,
} from "../actions";
import LeaderboardTable from "./LeaderboardTable";
import styles from "../leaderboards.module.scss";
import LeaderboardSelect from "./LeaderboardSelect";
import { HeroSection } from "@/devlink/HeroSection";
import Breadcrumb from "@/components/ui/Breadcrumb/Breadcrumb";
import LeaderboardMessagePrompt from "./LeaderboardsMessagePrompt";
import SignUpLogInButtons from "@/components/ui/Header/SignUpLogInButtons";
import { useRouter } from "next/navigation";
import { DevUserButtonPrimary } from "@/devlink/DevUserButtonPrimary";
import ClickEventProvider from "@/components/ui/Header/ClickEventProvider";
import { SchoolCodeModalFlow } from "@/components/ui/SchoolCodeModal/SchoolCodeModalFlow";
import { getSchoolCodeConfig } from "@/components/ui/SchoolCodeModal/actions";
import Loading from "@/components/ui/Loading/Loading";
//import TEST_DATA from "./TEST_DATA";

type Props = { session: any };

const LeaderboardsWrapper = ({ session }: Props) => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardPositionData, setLeaderboardPositionData] = useState(
    {} as any
  );
  const [{ entityType, level }, setDataToFetch] = useState({
    entityType: "user",
    level: "global",
  });
  const [meteorId, setMeteorId] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [entityIdToPass, setEntityIdToPass] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [schoolCodeModalLink, setSchoolCodeModalLink] = useState({});

  const router = useRouter();

  const onExplore = (e: any) => {
    e.preventDefault();
    router.push("/reptiles");
  };

  useEffect(() => {
    const getModalData = async () => {
      const configData = await getSchoolCodeConfig();
      setSchoolCodeModalLink({
        action: "openModal",
        content: {
          type: "popup",
          content: <SchoolCodeModalFlow configData={configData} />,
        },
      });
    };

    getModalData().catch((err) => {
      console.log("Error getting school code modal config.", err);
    });
  }, []);

  useEffect(() => {
    // console.log("useEffect entityType:", entityType);
    // console.log("useEffect level:", level);
    // console.log("useEffect session:", session);
    if (session && session.user) {
      const sa_id = session.user.sa_id;
      const checkIfSchoolCode = async () => {
        const currentChallengeId = await getActiveChallenge();
        setChallengeId(currentChallengeId);
        // console.log("useEffect - challengeId:", currentChallengeId);
        if (currentChallengeId) {
          const usersSchoolCode = await checkIfUserHasSchoolCode(
            sa_id,
            currentChallengeId
          );
          // console.log("usersSchoolCode:", usersSchoolCode);
          setSchoolCode(usersSchoolCode);
        }
      };

      if (!schoolCode) {
        checkIfSchoolCode().catch((err) => {
          console.log("Error checking User's School Code", err);
        });
      }

      if (entityType === "user") {
        setEntityIdToPass(sa_id);
      } else {
        // If entityType isn't "user" it must be a school
        const getSchoolId = async () => {
          // console.log(
          //   "getSchoolId - schoolCode:",
          //   schoolCode,
          //   "- challengeId:",
          //   challengeId,
          //   "- schoolId:",
          //   schoolId
          // );
          if (schoolCode && challengeId && !schoolId) {
            // console.log(
            //   "useEffect getSchoolIdFromSchoolCode - schoolCode:",
            //   schoolCode,
            //   "- challengeId:",
            //   challengeId
            // );
            const userSchoolId = (await getSchoolIdFromSchoolCode(
              challengeId,
              schoolCode
            )) as string;
            // console.log("useEffect - userSchoolId:", userSchoolId);
            if (userSchoolId) {
              setSchoolId(userSchoolId);
              setEntityIdToPass(userSchoolId);

              // console.log("School entityIdToPass:", userSchoolId);
            }
          }
        };

        if (schoolId) {
          setEntityIdToPass(schoolId);
        } else {
          getSchoolId().catch((err) => {
            console.log("Error getting user's SchoolId", err);
          });
        }
      }
    } else {
      // If the user isn't logged in then stop loading and show them the you need to login prompt
      setIsLoading(false);
    }
  }, [session, schoolCode, challengeId, entityType, schoolId, entityIdToPass]);

  useEffect(() => {
    // console.log("LeaderboardWrapper useEffect entityIdToPass:", entityIdToPass);
    // console.log("LeaderboardWrapper useEffect entityType:", entityType);
    // console.log("LeaderboardWrapper useEffect level:", level);
    if (entityIdToPass) {
      const fetchLeaderboardData = async () => {
        setIsLoadingLeaderboard(true);

        // console.log("Loading Leaderboard data!");
        try {
          const leaderboard = await getLeaderboard(
            entityIdToPass,
            entityType,
            level
          );
          if (leaderboard) {
            setErrorMessage("");
            setLeaderboardData(leaderboard as any);
          } else {
            setLeaderboardData([]);
            setErrorMessage(
              "Sorry there was an error loading the leaderboard, please try again later."
            );
          }

          const position = await getLeaderboardPosition(
            entityIdToPass,
            entityType,
            level
          );
          if (position) {
            setLeaderboardPositionData(position as any);
          } else {
            setLeaderboardPositionData({
              rankQuantityForActivePoints: 0,
              activePoints: 0,
              averagePoints: 0,
            });
          }

          const meteorId = await getUserMeteorId(entityIdToPass);
          setMeteorId(meteorId as string);
        } catch (err) {
          console.log("Error fetching leaderboard data", err);
        } finally {
          // console.log("Leaderboard data loaded!");
          setIsLoadingLeaderboard(false);
          setIsLoading(false);
        }
      };

      fetchLeaderboardData();
    }
  }, [entityType, level, entityIdToPass]);

  const schoolCodeButton = {
    action: "openModal",
    path: "/leaderboards",
    buttonTextText: "Enter your school code",
    buttonLink: true,
    buttonIconShow: true,
    buttonTextShow: true,
    buttonIconImage:
      "https://uploads-ssl.webflow.com/662b83188ec66564f24768e3/66990331bd62d8be95b48681_school-code-icon.svg",
  };

  let isMobile = false;
  // Ensure this is only checked and set in the client
  if (typeof window !== "undefined") {
    isMobile = window && window.innerWidth < 568;
  }

  //console.log("leaderboardData", leaderboardData);
  return (
    <>
      {!isLoading && (
        <>
          <Breadcrumb
            breadcrumbObject={{
              courseName: "Reptile Wonders",
              courseSlug: "reptiles",
              moduleName: "Leaderboard",
              breadcrumbLevel: "module",
            }}
            isMarginTop={true}
          />
          <HeroSection
            title="Challenge Scores"
            text="Curious about your standings? Take a look around and see how you fared. Celebrate your progress and compare your scores! Use the dropdown to see all the categories you're making a mark in."
            image="https://cdn.itza.world/itza-mvp-images/GettyImages-93105957-noBG.png"
            showImage={!isMobile}
            showToolbar={false}
          />

          {errorMessage && (
            <LeaderboardMessagePrompt
              message={errorMessage}
              isMobile={isMobile}
            >
              <button
                className={styles.schoolCodeButton}
                onClick={(e: any) => onExplore(e)}
              >
                Return to challenge hub
              </button>
            </LeaderboardMessagePrompt>
          )}

          {!errorMessage && !session && (
            <LeaderboardMessagePrompt
              message="You must be logged in to see the leaderboards"
              isMobile={isMobile}
            >
              <SignUpLogInButtons />
            </LeaderboardMessagePrompt>
          )}

          {!errorMessage && session && !schoolCode && (
            <LeaderboardMessagePrompt
              message="You must enter your school code to see this leaderboard."
              isMobile={isMobile}
            >
              <ClickEventProvider data={schoolCodeModalLink}>
                <DevUserButtonPrimary
                  userButtonIconImage={schoolCodeButton.buttonIconImage}
                  userButtonIconShow={schoolCodeButton.buttonIconShow}
                  userButtonText={schoolCodeButton.buttonTextText}
                  userButtonIconAltText={schoolCodeButton.buttonTextText}
                  userButtonTextShow={schoolCodeButton.buttonTextShow}
                />
              </ClickEventProvider>
            </LeaderboardMessagePrompt>
          )}

          {!errorMessage && session && schoolCode && (
            <div className={styles.wrapper}>
              <div className={styles.dropdownContainer}>
                <LeaderboardSelect
                  setDataToFetch={setDataToFetch}
                  setEntityIdToPass={setEntityIdToPass}
                />
              </div>
              <div className={styles.positionContainer}>
                {isLoadingLeaderboard && <Loading />}
                {!isLoadingLeaderboard && (
                  <>
                    {entityType === "user" &&
                      leaderboardPositionData.activePoints === 0 && (
                        <div className={styles.wrapper}>
                          <LeaderboardMessagePrompt
                            message="You haven’t earned any points yet. Go to the challenge hub and start exploring."
                            isMobile={isMobile}
                          >
                            <button
                              className={styles.schoolCodeButton}
                              onClick={(e: any) => onExplore(e)}
                            >
                              Explore
                            </button>
                          </LeaderboardMessagePrompt>
                        </div>
                      )}

                    {(entityType === "school" ||
                      (entityType === "user" &&
                        leaderboardPositionData.activePoints > 0)) && (
                      <LeaderboardTable
                        leaderboardData={leaderboardData}
                        leaderboardPositionData={leaderboardPositionData}
                        entityType={entityType}
                        isMobile={isMobile}
                        userId={meteorId}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {!errorMessage && isLoading && (
        <div className={styles.loadingWrapper}>
          <Loading />
        </div>
      )}
    </>
  );
};

export default LeaderboardsWrapper;
