const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const authenticateMiddleWare = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  console.log(jwtToken)
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
      console.log(jwtToken)
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        console.log(payload);
        response.status(401)
        response.send("Invalid JWT Token");
      } else {
        console.log(payload);
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticateMiddleWare, async (request, response) => {
  try {
    const getStateQuery = ` SELECT  state_id as stateId , state_name as stateName,population  FROM state`;
    const states = await db.all(getStateQuery);
    response.send(states);
  } catch (err) {
    console.log(err);
  }
});

app.get("/states/:stateId/", authenticateMiddleWare,
  async (request, response) => {
    try {
      const { stateId } = request.params;
      const getStateQuery = `
      SELECT
        state_id as stateId , state_name as stateName,population 
      FROM
       state 
      WHERE
       state_id = ${stateId};
    `;
      const state = await db.get(getStateQuery);
      response.send(state);
    } catch (err) {
      console.log(err);
    
    }
  }
);

app.post("/districts/",authenticateMiddleWare, async (request, response) => {
  try {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const selectDistrictQuery = `
      INSERT INTO 
        district  (district_name, state_id, cases, cured, active,deaths) 
      VALUES 
        (
          '${districtName}', 
          '${stateId}',
          '${cases}', 
          '${cured}',
          '${active}','${deaths}'
        )`;
    await db.all(selectDistrictQuery);
    response.send(`District Successfully Added`);
  } catch (err) {
    console.log(err.message);

  }
});

app.get(
  "/districts/:districtId/",
  authenticateMiddleWare,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const getDistrictQuery = `
      SELECT
       district_id as districtId,
       district_name as districtName,
       state_id as stateId,
       cases,cured,active,deaths
      FROM
       district 
      WHERE
       district_id = ${districtId};
    `;
      const district = await db.get(getDistrictQuery);
      response.send(district);
    } catch (err) {
      console.log(err.message);
   
    }
  }
);

app.delete("/districts/:districtId/",
authenticateMiddleWare,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const districtDeleteQuery = `DELETE FROM district where district_id=${districtId}`;
      await db.run(districtDeleteQuery);
      response.send("District Removed");
    } catch (err) {
      console.log(err.message);
   
    }
  }
);

app.put(
  "/districts/:districtId/",
authenticateMiddleWare,
  async (request, response) => {
    try {
      const {
        districtName,
        stateId,
        cases,
        cured,
        active,
        deaths,
      } = request.body;
      const { districtId } = request.params;

      const selectDistrictQuery = `SELECT * FROM district WHERE district_id = '${districtId}'`;
      const dbDistrict = await db.get(selectDistrictQuery);
    
      if (dbDistrict !== undefined) {
        const updateDistrictQuery = `
      UPDATE  
        district SET district_name ='${districtName}', state_id ='${stateId}',cases='${cases}',cured='${cured}', 
        active= '${active}',deaths='${deaths}'  where district_id = ${districtId}`;

        await db.run(updateDistrictQuery);
        response.send(`District Details Updated`);
      }
    } catch (err) {
      console.log(err);
    }
  }
);

app.get(
  "/states/:stateId/stats/",
   authenticateMiddleWare,
  async (request, response) => {
    try {
      const { stateId } = request.params;
      const getStateStatsQuery = `SELECT SUM(cases) as totalCases ,SUM(cured) as totalCured,
     SUM(active) as totalActive,SUM(deaths) as totalDeaths FROM district where state_id = ${stateId} GROUP by state_id`;
      const result = await db.get(getStateStatsQuery);
      response.send(result);
    } catch (err) {
      console.log(err);
    }
  }
);


module.exports = app;