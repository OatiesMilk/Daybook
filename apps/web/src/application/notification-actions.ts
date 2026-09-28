"use server";
import { notificationData } from "./queries";

// The verified session determines the owner; no client-provided user ID is accepted.
export async function loadReminders() { return notificationData(); }
