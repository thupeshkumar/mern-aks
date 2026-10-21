import React, { useEffect, useState } from "react";
import axios from "axios";

// In production (AKS) the frontend's nginx proxies these paths to the backend
// services. For local development, see frontend/.env.development.
const HELLO_URL = process.env.REACT_APP_HELLO_URL || "/api/hello";
const PROFILE_URL = process.env.REACT_APP_PROFILE_URL || "/api/profile";

function Home() {
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState([]);

  useEffect(() => {
    axios
      .get(`${HELLO_URL}/`)
      .then((response) => {
        setMessage(response.data.msg);
      })
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

  useEffect(() => {
    axios
      .get(`${PROFILE_URL}/fetchUser`)
      .then((response) => {
        setProfile(response.data);
        
      })
      .catch((error) => console.error("Error fetching data:", error));
  },[]);

  

  return (
    <div className="App">
      <h1>{message}</h1>
      <div>
        <h2>Profile</h2>
        {
        profile.map((user) => {
            console.log('user', user)
          return (
            <div>
              <h3>Name: {user.name}</h3>
              <h3>Age: {user.age}</h3>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Home;
