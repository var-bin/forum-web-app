"use strict";

// src/ui.js

import xss from "xss-filters";

import {
  POSTS_DOM_TARGET,
  USERS_DOM_TARGET,
} from "./constants";

function articleTemplate(title, lastReply) {
  let safeTitle = xss.inHTMLData(title);
  let safeLastReply = xss.inHTMLData(lastReply);

  let template = `
    <article class="post">
      <h2 class="post-title">
        ${safeTitle}
      </h2>
      <p class="post-meta">
        ${safeLastReply}
      </p>
    </article>`;

  return template;
}

function userTemplate(name, avatar) {
  let safeName = xss.inHTMLData(name);
  let safeAvatar = xss.inHTMLData(avatar);

  let template = `
    <div class="active-avatar">
      <img width="54" src="./assets/images/${safeAvatar}" alt="${safeName}"/>
      <h5 class="post-author">
        ${safeName}
      </h5>
    </div>`;

  return template;
}

export const ui = {
  renderPosts(posts) {
    let elements = posts.map((post) => {
      let {
        title,
        lastReply,
      } = post;

      return articleTemplate(title, lastReply);
    });

    let target = document.querySelector(POSTS_DOM_TARGET);
    target.innerHTML = elements.join("");
  },

  renderUsers(users) {
    let elements = users.map( (user) => {
      let {
        name,
        avatar,
      } = user;

      return userTemplate(name, avatar);
    });

    let target = document.querySelector(USERS_DOM_TARGET);
    target.innerHTML = elements.join("");
  }
};
