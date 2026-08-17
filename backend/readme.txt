BACKEND README
================

This folder contains the Supabase Edge Functions used by the Cellular Automata voting website.

FUNCTIONS
---------

vote
----
Receives a user's vote.

Expected request:
{
  "session_id": "anonymous-session-id",
  "round_id": "round-id",
  "winner": "16-character-rule"
}

The vote function records the session ID, round ID, and winning rule.

No account, name, or email is required.


next-round
----------
Returns a new set of four rules for the frontend.

Expected response:
{
  "round_id": "round-id",
  "rules": [
    "2112121122122122",
    "2112211222221111",
    "2112212222121222",
    "2121221121121121"
  ]
}

The frontend uses these four rules to create the current voting round.


history
-------
Returns the rules that the current anonymous session has previously voted for in reverse chronological order.

Request:
{
  "session_id": "anonymous-session-id"
}

Response:
{
  "ok": true,
  "votes": [
    {
      "winner": "2112121122122122"
    },
    {
      "winner": "2112211222221111"
    }
  ]
}

History intentionally returns only the winning rule.

It does NOT return:
- round ID
- creation time
- the other rules shown in the round
- user account information


ANONYMOUS SESSIONS
------------------

The frontend generates a random session ID when a visitor first opens the website.

The session ID is stored in the browser's localStorage:

caSessionId

This allows the history function to show that browser's previous votes without requiring user accounts or login.


RULE FORMAT
-----------

Rules are 16-character strings containing only:

1
2

Example:

2112121122122122

DATABASE
--------

The Edge Functions communicate with the Supabase database.

The frontend does not directly access the database.

Frontend flow:

Browser
   |
   +--> next-round
   |
   +--> vote
   |
   +--> history
          |
          v
       Supabase
