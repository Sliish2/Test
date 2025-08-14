import styles from "../leaderboards.module.scss";

TEST

const SELECT_OPTIONS_TITLE: any = {
  globalUsers: "Worldwide Students",
  globalSchools: "Worldwide Schools",
  countrySchools: "Schools in Your Country/Region",
  countryUsers: "Students in Your Country/Region",
  schoolUsers: "Students in Your School",
};

const SELECT_OPTIONS_STATE: any = {
  globalSchools: { entityType: "school", level: "global" },
  countrySchools: { entityType: "school", level: "country" },
  globalUsers: { entityType: "user", level: "global" },
  countryUsers: { entityType: "user", level: "country" },
  schoolUsers: { entityType: "user", level: "school" },
};

const LeaderboardSelect = ({ setDataToFetch, setEntityIdToPass }: any) => {
  const handleOnChange = (e: any) => {
    setEntityIdToPass("");
    // console.log("Leaderboard Select e.target.value", e.target.value);
    setDataToFetch(SELECT_OPTIONS_STATE[e.target.value]);
  };

  return (
    <select className={styles.dropdown} onChange={(e) => handleOnChange(e)}>
      {Object.keys(SELECT_OPTIONS_TITLE).map((key, index) => (
        <option key={index} value={key} className="menu-item">
          {SELECT_OPTIONS_TITLE[key]}
        </option>
      ))}
    </select>
  );
};

export default LeaderboardSelect;
