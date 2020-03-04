"use strict";

// src/post.js

import { API } from "./api";
import { POSTS_URI } from "./constants";

export const Post = {
  findAll() {
    return API.fetch(POSTS_URI);
  }
};
