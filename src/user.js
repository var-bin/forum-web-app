"use strict";

// src/user.js

import { API } from "./api";
import { ACTIVE_USERS_URI } from "./constants";

export const User = {
  findRecent() {
    return API.fetch(ACTIVE_USERS_URI);
  }
};
