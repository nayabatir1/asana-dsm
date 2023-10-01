const baseUrl = "https://app.asana.com";
let project;
let email;
const localStorageKeys = {
  name: "name",
  email: "email",
  token: "token",
};
const today = new Date();

const urls = {
  task: baseUrl + "/api/1.0/tasks",
  users: baseUrl + "/api/1.0/users",
};

const headers = {
  accept: "application/json",
};

const requestOptions = {
  method: "GET",
  headers: headers,
};

const copyBtn = document.getElementById("copy");
const errorEle = document.getElementById("error");
const saveBtn = document.getElementById("save");
const emailEle = document.getElementById("email");
const tokenEle = document.getElementById("token");

saveBtn.onclick = save;
copyBtn.onclick = start;

async function fetchName() {
  return new Promise(async (res, rej) => {
    const temp = await getDataFromLocalStorage(localStorageKeys.name);

    if (temp) res(temp);

    const userQueryParams = {
      opt_fields: "name,email",
    };

    const userQueryString = new URLSearchParams(userQueryParams).toString();
    const userFetchUrl = `${urls.users}?${userQueryString}`;

    const response = await fetch(userFetchUrl, requestOptions);
    if (!response.ok) {
      rej(`HTTP error! Status: ${response.status}`);
    }
    const { data } = await response.json();
    const [{ name }] = data.filter((d) => d.email === email);

    await saveDataToLocalStorage(localStorageKeys.name, name);

    res(name);
  });
}

async function fetchToday(name) {
  return new Promise(async (res, rej) => {
    try {
      const todayQueryParams = {
        project,
        completed_since: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        ).toISOString(),
        opt_fields:
          "completed_at,completed_by,assignee.name,completed_by.name,name,permalink_url",
      };

      const todayQueryString = new URLSearchParams(todayQueryParams).toString();
      const todayFetchUrl = `${urls.task}?${todayQueryString}`;

      const response = await fetch(todayFetchUrl, requestOptions);
      if (!response.ok) {
        rej(`HTTP error! Status: ${response.status}`);
      }
      const { data } = await response.json();
      const temp = data
        .filter((d) => d.completed_by)
        .filter((d_1) => d_1.completed_by.name === name);

      let text = "*Today*\n";

      if (!temp.length) text += "- --";

      temp.forEach((d_2) => {
        text += `- [${d_2.name}](${d_2.permalink_url})\n`;
      });

      res(text);
    } catch (error) {
      rej(error);
    }
  });
}

async function fetchTomorrow(name) {
  return new Promise(async (res, rej) => {
    try {
      const tomorrowQueryParams = {
        project,
        opt_fields: "due_on,name,assignee.name,completed,permalink_url",
        completed_since: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1
        ).toISOString(),
      };

      const tomorrowQueryString = new URLSearchParams(
        tomorrowQueryParams
      ).toString();
      const tomorrowUrl = `${urls.task}?${tomorrowQueryString}`;

      const response = await fetch(tomorrowUrl, requestOptions);
      if (!response.ok) {
        rej(`HTTP error! Status: ${response.status}`);
      }
      const { data } = await response.json();

      const temp = data
        .filter((d) => !d.completed)
        .filter((e) => e.assignee)
        .filter((f) => f.assignee.name === name)
        .filter((g) => !String(g.name).toLowerCase().includes("review"))
        .filter((g) => !String(g.name).toLowerCase().includes("meet"));

      let text = "*Tomorrow*\n";

      if (!temp.length) text += "- --";

      temp.forEach((d_2) => {
        text += `- [${d_2.name}](${d_2.permalink_url})\n`;
      });

      res(text);
    } catch (error) {
      rej(error);
    }
  });
}

async function start() {
  try {
    errorEle.classList.add("hidden");
    const token = await getDataFromLocalStorage(localStorageKeys.token);

    headers.authorization = "Bearer " + token;

    copyBtn.disabled = true;

    const name = await fetchName();

    const [today, tomorrow] = await Promise.all([
      fetchToday(name),
      fetchTomorrow(name),
    ]);

    const text = today + "\n\n" + tomorrow + "\n\n*Blocker*\n- --";

    await navigator.clipboard.writeText(text);

    copyBtn.disabled = false;
  } catch (error) {
    errorEle.innerText = error;
    errorEle.classList.remove("hidden");

    copyBtn.disabled = false;
    console.log(error);
  }
}

async function save() {
  const email = emailEle.value;
  const token = tokenEle.value;

  const u = await getUrl();
  console.log(u);

  await Promise.allSettled([
    saveDataToLocalStorage(localStorageKeys.token, token),
    saveDataToLocalStorage(localStorageKeys.email, email),
  ]);

  copyBtn.disabled = false;

  errorEle.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    const [emailId, token] = await Promise.all([
      getDataFromLocalStorage(localStorageKeys.email),
      getDataFromLocalStorage(localStorageKeys.token),
    ]);

    const url = await getUrl();

    project = url.split("/")[4];

    if (!emailId || !token) {
      copyBtn.disabled = true;
      errorEle.innerText = "Set token and Email";
      errorEle.classList.remove("hidden");
    }

    emailEle.value = emailId || "";
    tokenEle.value = token || "";
    email = emailId;
  } catch (error) {
    errorEle.innerText = error;
    errorEle.classList.remove("hidden");
    console.log(error);
  }
});

// save data to localStorage
function saveDataToLocalStorage(key, value) {
  return new Promise(async (res, rej) => {
    let data = await getDataFromLocalStorage({});

    if (!data) data = {};

    data[key] = value;

    chrome.storage.sync.set(data, function () {
      if (chrome.runtime.lastError) {
        rej(
          "Failed to save data to local storage: " + chrome.runtime.lastError
        );

        res();
      }
    });
  });
}

// Retrieve data from localStorage
function getDataFromLocalStorage(key) {
  return new Promise((res, rej) => {
    chrome.storage.sync.get(key, function (result) {
      if (chrome.runtime.lastError) {
        rej(
          "Failed to get data from local storage: " + chrome.runtime.lastError
        );
      } else {
        const data = result[key];
        res(data);
      }
    });
  });
}

// get url
function getUrl() {
  return chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tab) => {
      const [currentTab] = tab;
      return currentTab.url;
    });
}
