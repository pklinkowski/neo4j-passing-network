# Neo4j Passing Network – Proof of Concept

Projekt typu **proof of concept** prezentujący analizę sieci podań w meczu piłkarskim
z wykorzystaniem grafowej bazy danych **Neo4j** oraz aplikacji webowej (backend + frontend).

Dokumentacja projektu znajduje się w osobnym pliku.

---

## Wymagania

- Node.js (v18+)
- Konto w Neo4j AuraDB (plan Free)
- Git

---

## Konfiguracja bazy danych

1. Utwórz instancję bazy danych w **Neo4j AuraDB**.
2. W katalogu `backend/` utwórz plik `.env` na podstawie `.env.example`:

```env
NEO4J_URI=neo4j+s://<your-instance>.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=<your-password>
PORT=3001
```
## Uruchomienie backendu
```
cd backend
node src/index.js
```
Backend uruchomi się pod adresem <href>http://localhost:3001

## Uruchomienie frontendu
w osobnym terminalu:
```
cd frontend
npm install
npm run dev
```
Frontend będzie dostępny pod adresem <href>http://localhost:5173

## Import danych meczowych
Dane do meczu można znaleźć w bazie danych StatsBomb <href>https://github.com/statsbomb/open-data/tree/master/data/events


