# BAZL aircraft import

---
**NOTICE**

At the moment, the file to import is hardcoded to `testdata/aircrafts.xls`
which is part of this project.

---

This script imports the aircrafts of the BAZL register into a Firebase database.

The aircrafts are written to `/aircrafts`. Each aircraft item has the following structure:

```
{registration}: {
  type: {ICAO type}
  mtow: {mtow in kilograms}
}
```
## How to use it

Install the dependencies:

```
npm install
```

Define the required environment variables:

| Name         | Description
| -------------|------------
| FIREBASE_URL | The URL of the Firebase database. 
| AUTH_URL     | The URL of the authentication service which is used to generate the token for Firebase.
| USERNAME     | The username which is used to authenticate.
| PASSWORD     | The password which is used to authenticate.

Execute the script:

```
node index.js
```
