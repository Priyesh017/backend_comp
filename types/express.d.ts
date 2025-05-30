import { Request } from "express";

declare module "express" {
  export interface Request {
    Role?: string;
    centerId?: number;
    userId?: number;
    email?: string;
  }
}
