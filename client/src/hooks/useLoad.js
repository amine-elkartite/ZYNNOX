import { useEffect, useState } from "react";
import { api } from "../services/api.js";

export function useLoad(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!endpoint) {
      setData(null);
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    api(endpoint, { public: options.public })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active) {
          setData(null);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint, tick, options.public]);

  return [data || {}, () => setTick((value) => value + 1), { loading, error }];
}
