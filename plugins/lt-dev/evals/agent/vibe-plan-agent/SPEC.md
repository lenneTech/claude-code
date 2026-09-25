# SPEC: Appointments

A backend module for appointments in this @lenne.tech/nest-server API. REST only, no frontend in this iteration.

## Data

An appointment has: title (required), startsAt and endsAt (required, endsAt after startsAt), notes (optional),
status, and the user it belongs to (the user who created it).

## Rules

1. A logged-in user sees, edits and deletes only their own appointments. Admins see and manage all appointments.
2. A user's appointments must not overlap in time. Creating or moving an appointment into an occupied slot is
   rejected, including when two requests for the same slot arrive at the same moment.
3. Status transitions: `planned` → `confirmed` → `done`, and `planned` or `confirmed` → `cancelled`. Every other
   transition is rejected. A `done` or `cancelled` appointment can no longer be edited.
4. 24 hours before `startsAt`, the owner receives a reminder email, exactly once per appointment, also when the
   appointment was moved or the server restarted in between. Cancelled appointments get no reminder.
5. Times are stored in UTC; the API accepts and returns ISO 8601 with an offset.

## Endpoints

List own appointments (admins: all, filterable by user), get one, create, update, change status, delete.

## Done when

Every rule above is covered by an API test that fails without the rule, for both a normal user and an admin where
the rule differs between them.
