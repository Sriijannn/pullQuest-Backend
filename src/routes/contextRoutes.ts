import { Router } from "express";
import { getUserByEmail } from "../controllers/contextController"; // ✅ Correct

const router = Router();

router.get("/context/:email", getUserByEmail);

export default router;
