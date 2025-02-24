import React, { useEffect, useState, useRef } from "react";
import TaskList from "./TaskList.tsx";
import { Task } from "../types/index";
import { LOCALHOST } from "../const.ts";

const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const debounceTimeout = useRef<number | null>(null);
  const debounceTimeInterval = 300;

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError("");
      return;
    }
    fetch(`${LOCALHOST}/tasks?q=${encodeURIComponent(searchQuery)}`, {
      cache: "no-cache",
    })
      .then((res) => res.json())
      .then((data) => {
        setResults(data);
        setError("");
      })
      .catch((err) => {
        console.error("Search failed", err);
        setError("Search failed, please retry later");
      });
  };

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      handleSearch(query);
    }, debounceTimeInterval);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [query]);

  return (
    <div className="m-6">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Task..."
        className="w-full p-2 border border-gray-300 rounded-lg"
      />
      {error && <p className={"mt-2 text-red-500"}>{error}</p>}
      <TaskList tasks={results} />
    </div>
  );
};

export default SearchBar;
