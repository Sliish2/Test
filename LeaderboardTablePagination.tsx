import React from "react";

import styles from "../leaderboards.module.scss";

type Test = {
  entriesPerPage: test;
  length: number;
  handlePagination: (arg0: number) => void;
  currentPage: number;
};

type Props = {
  entriesPerPage: number;
  length: number;
  handlePagination: (arg0: number) => void;
  currentPage: number;
};

const LeaderbordTablePagination: React.FC<Props> = ({
  entriesPerPage = 20,
  length,
  handlePagination,
  currentPage,
}) => {
  const paginationNumbers = [];

  for (let i = 1; i <= Math.ceil(length / entriesPerPage); i++) {
    // @ts-ignore
    paginationNumbers.push(i);
  }

  if (paginationNumbers.length === 1) {
    return null;
  }

  return (
    <div className={styles.pagination}>
      {paginationNumbers.map((pageNumber) => (
        <button
          key={pageNumber}
          onClick={() => handlePagination(pageNumber)}
          className={currentPage === pageNumber ? `${styles.active}` : ""}
        >
          {pageNumber}
        </button>
      ))}
    </div>
  );
};
export default LeaderbordTablePagination;
