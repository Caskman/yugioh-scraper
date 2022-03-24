import prompts from "prompts";
import { parse } from "node-html-parser";
import fetch from "node-fetch";
import fs from "fs";

const search = async (query) => {
  const response = await fetch(
    `https://yugioh.fandom.com/wikia.php?controller=UnifiedSearchSuggestionsController&method=getSuggestions&query=${query}&format=json`,
    {
      headers: {
        accept: "*/*",
        // "accept-language": "en-US,en;q=0.9,fr;q=0.8",
        // "cache-control": "no-cache",
        // pragma: "no-cache",
        // "sec-ch-ua":
        //   '" Not A;Brand";v="99", "Chromium";v="99", "Google Chrome";v="99"',
        // "sec-ch-ua-mobile": "?0",
        // "sec-ch-ua-platform": '"macOS"',
        // "sec-fetch-dest": "empty",
        // "sec-fetch-mode": "cors",
        // "sec-fetch-site": "same-origin",
        // cookie:
        //   "Geo={%22region%22:%22TX%22%2C%22country%22:%22US%22%2C%22continent%22:%22NA%22}; WikiaSessionSource=https%3A%2F%2Fwww.google.com%2F; WikiaLifetimeSource=https%3A%2F%2Fwww.google.com%2F; wikia_beacon_id=JgNMuKWY8L; wikia_session_id=iCbFdFG4wQ; _b2=aiK_VmxvVG.1640496728108; fandom_global_id=0aa079b7-4ef5-40fa-bb5d-ae5f929e3756; tracking_session_id=6f64351d-d03d-4a8b-b020-ef11b360c1fe; featuredVideoSeenInSession=iCbFdFG4wQ; playerImpressionsInWiki=2; pv_number=3; pv_number_global=3",
        // Referer: "https://yugioh.fandom.com/wiki/Ceasefire",
        // "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: null,
      method: "GET",
    }
  );
  const result = JSON.parse(await response.text());

  const page = await scrape(result.suggestions[0]);

  const root = parse(page);
  const rows = root.querySelector(
    "#mw-content-text > div > table.cardtable > tbody"
  );

  const cardResult = {};

  const goodRows = rows.childNodes.filter((n) => n.rawTagName === "tr");
  goodRows.forEach((n) => {
    //   const name = collapse(n.childNodes[0].childNodes[0]);
    let name = n?.childNodes[0]?.childNodes[0]?._rawText;
    if (!name) {
      name = n?.childNodes[0]?.childNodes[0]?.childNodes[0]?._rawText;
    }
    // console.log(name);
    if (name === "English") {
      // console.log(collapse( n.childNodes[1]));
      let cardName = collapse(n.childNodes[1]);
      cardResult.name = clean(cardName);
    }
    if (name === "Card type") {
      const type = n.childNodes[1].childNodes[1].childNodes[0]._rawText;
      // console.log(type)
      cardResult.type = type;
    }
    if (name === "Card descriptions") {
      let desc = collapse(n.childNodes[0].childNodes[3]);
      desc = desc.replace("&#160; English", "");
      cardResult.description = clean(desc);
      // console.log(desc);
      // console.log(collapse(n.childNodes[0].childNodes[3]));
    }
    if (name === "Level") {
      const level = n.childNodes[1].childNodes[1].childNodes[0]._rawText;
      // console.log(level);
      cardResult.level = level;
    }
    if (name === "ATK") {
      let atk = collapse(n.childNodes[1]);
      // console.log(atk)
      cardResult.stats = clean(atk);
    }
    if (name === "Attribute") {
      let attr = clean(collapse(n.childNodes[1]));
      cardResult.attribute = attr;
      // console.log(attr);
    }
    if (name === "Passcode") {
      let passcode = clean(collapse(n.childNodes[1]));
      cardResult.passcode = passcode;
      // console.log(passcode);
    }
    if (name === "Types") {
      let types = clean(collapse(n.childNodes[1]));
      cardResult.types = types;
      // console.log(types);
    }
  });
  return cardResult;
};

const clean = (s) => {
  s = s.replace(/\s+/gm, " ");
  s = s.replace(/^\s+|\s+$/gm, "");
  return s;
};

const collapse = (n) => {
  let ss = [];
  if (n.childNodes) {
    ss = n.childNodes.map((c) => collapse(c));
  }
  if (n._rawText) {
    ss.unshift(n._rawText);
  }
  return ss.join(" ");
};

const scrape = async (inputStr) => {
  const response = await fetch(`https://yugioh.fandom.com/wiki/${inputStr}`, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      //   "accept-language": "en-US,en;q=0.9,fr;q=0.8",
      //   "cache-control": "no-cache",
      //   pragma: "no-cache",
      //   "sec-ch-ua":
      //     '" Not A;Brand";v="99", "Chromium";v="99", "Google Chrome";v="99"',
      //   "sec-ch-ua-mobile": "?0",
      //   "sec-ch-ua-platform": '"macOS"',
      //   "sec-fetch-dest": "document",
      //   "sec-fetch-mode": "navigate",
      //   "sec-fetch-site": "none",
      //   "sec-fetch-user": "?1",
      //   "upgrade-insecure-requests": "1",
    },
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
  });
  return await response.text();
};

const processLineForScraping = async (line) => {
  let name = clean(clean(line).replace(/\d+$/, ""));
  name = name.replace("#", "");
  name = name.replace(/Card$/, "");

  let returnVal = {
    originalName: name,
  };

  try {
    const cardVals = await search(name);
    returnVal = {
      ...returnVal,
      ...cardVals,
    };
  } catch {
    returnVal.error = true;
  }
  return returnVal;
};

const scrapeData = async () => {
  let allCardData = JSON.parse(fs.readFileSync("allcarddata6.json").toString());
  // const allCardLines = fs.readFileSync("allcards.txt").toString().split('\n');
  const errors = allCardData.filter((c) => c.error);
  const errorCards = await Promise.all(
    errors.map((c) => c.originalName).map(processLineForScraping)
  );

  const finalCards = allCardData.filter((c) => !c.error).concat(errorCards);
  //   const finalCards = await Promise.all(allCardLines.map(processLineForScraping));
  console.log(finalCards.filter((c) => c.error).length);
  console.log(finalCards.length);
  fs.writeFileSync("allcarddata7.json", JSON.stringify(finalCards, null, 4));
};

const readAndProcessCards = () => {
  let allCards = JSON.parse(fs.readFileSync("allcarddata.json").toString());
  return allCards.map((c) => {
    delete c.originalName;
    if (c.type === "Monster") {
      c.level = parseInt(c.level);

      const rx = /^(\d+) \/ (\d+)$/g;
      const result = rx.exec(c.stats);
      c.atk = parseInt(result[1]);
      c.def = parseInt(result[2]);
      delete c.stats;
    }
    if (c.types) {
      c.types = c.types.split("/").map((t) => clean(t));
    }
    return c;
  });
};

const bestNonTributeCards = async () => {
  const allCards = readAndProcessCards();

  const nonTributeMonsters = allCards.filter(
    (c) =>
      c.type === "Monster" &&
      ((c.types &&
        c.types.filter((t) => t === "Effect" || t === "Fusion").length === 0) ||
        !c.types) &&
      c.level <= 4
  );
  const atkRanked = [...nonTributeMonsters].sort((a, b) => b.atk - a.atk);
  //   const defRanked = [...nonTributeMonsters].sort((a, b) => b.def - a.def);

  console.log("ATK");
  console.log(atkRanked.slice(0, 10));
  //   console.log("DEF");
  //   console.log(defRanked.slice(0, 10));
};

const best1TributeCards = async () => {
  const allCards = readAndProcessCards();

  const nonTributeMonsters = allCards.filter(
    (c) =>
      c.type === "Monster" &&
      ((c.types &&
        c.types.filter((t) => t === "Effect" || t === "Fusion").length === 0) ||
        !c.types) &&
      c.level >= 5 &&
      c.level <= 6
  );
  const atkRanked = [...nonTributeMonsters].sort((a, b) => b.atk - a.atk);
  const defRanked = [...nonTributeMonsters].sort((a, b) => b.def - a.def);

  console.log("ATK");
  console.log(atkRanked.slice(0, 10));
  //   console.log("DEF");
  //   console.log(defRanked.slice(0, 10));
};

const best2TributeCards = async () => {
  const allCards = readAndProcessCards();

  const nonTributeMonsters = allCards.filter(
    (c) =>
      c.type === "Monster" &&
      ((c.types &&
        c.types.filter((t) => t === "Effect" || t === "Fusion").length === 0) ||
        !c.types) &&
      c.level >= 7
  );
  const atkRanked = [...nonTributeMonsters].sort((a, b) => b.atk - a.atk);
  const defRanked = [...nonTributeMonsters].sort((a, b) => b.def - a.def);

  console.log("ATK");
  console.log(atkRanked.slice(0, 10));
  //   console.log("DEF");
  //   console.log(defRanked.slice(0, 10));
};

const allRitualCards = async () => {
  const allCards = readAndProcessCards();

  const ritualCards = allCards.filter(
    (c) => c.types && c.types.filter((t) => t === "Ritual").length > 0
  );
  console.log(ritualCards);
  console.log(ritualCards.length);
  //   console.log("DEF");
  //   console.log(defRanked.slice(0, 10));
};

const allFlipMonsters = async () => {
  const allCards = readAndProcessCards();

  const cards = allCards.filter(
    (c) => c.types && c.types.filter((t) => t === "Flip").length > 0
  );
  console.log(cards);
  console.log(cards.length);
  //   console.log("DEF");
  //   console.log(defRanked.slice(0, 10));
};

const allFusionMonsters = async () => {
  const allCards = readAndProcessCards();

  const cards = allCards.filter(
    (c) => c.types && c.types.filter((t) => t === "Fusion").length > 0
  );
  const atkRanked = [...cards].sort((a, b) => b.atk - a.atk);
  console.log(atkRanked);
  console.log(atkRanked.length);
  //   console.log("DEF");
  //   console.log(defRanked.slice(0, 10));
};

const allPossibleThings = async () => {
  const allCards = readAndProcessCards();

  const attributes = {};
  const monsterTypes = {};
  const cardTypes = {};

  allCards.forEach((c) => {
    if (c.attribute) {
      attributes[c.attribute] = true;
    }
    if (c.type) {
      cardTypes[c.type] = true;
    }
    if (c.types) {
      c.types.forEach((t) => {
        monsterTypes[t] = true;
      });
    }
  });

  console.log("Attributes");
  console.log(Object.keys(attributes));
  console.log("Monster Types");
  console.log(Object.keys(monsterTypes));
  console.log("Card Types");
  console.log(Object.keys(cardTypes));
};

const allSpells = async () => {
  const allCards = readAndProcessCards();

  const spells = allCards.filter((c) => c.type === "Spell");

  spells.forEach((s) => console.log(`${s.name}: ${s.description}`));

  console.log();
  console.log(spells.length);
};

const pickCards = async (cards) => {
  const picked = [];
  for (const c of cards) {
    const response = await prompts({
      type: "confirm",
      name: "pick",
      message: JSON.stringify(c, null, 4),
    });
    if (response.pick) {
      picked.push(c);
    }
  }
  return picked;
};

const readSavedCards = () => {
  const allCards = readAndProcessCards();
  let savedCards = fs.readFileSync("savedCards.txt").toString();
  return savedCards
    .split("\n")
    .filter((c) => clean(c) !== "")
    .map((c) => {
      const found = allCards.filter((ac) => ac.name === c);
      if (found.length !== 1) {
        throw new Error(`Weird, looking for ${c} and found ${found}`);
      }
      return found[0];
    });
};

const writeSavedCards = (cards) => {
  const str = cards.map((c) => c.name).join("\n");
  fs.writeFileSync("savedCards.txt", str);
};

const addCardsToSaved = (cards) => {
  const alreadySavedCards = readSavedCards();
  const newSetOfCards = alreadySavedCards.concat(cards);
  writeSavedCards(newSetOfCards);
};

const browseCards = async () => {
  const allCards = readAndProcessCards();

  const cards = allCards.filter(
    (c) =>
      c.type === "Trap"
    //    &&
    //   c.types &&
    //   c.types.filter((t) => t === "Effect").length > 0 &&
    //   c.types.filter((t) => t === "Fusion").length === 0 &&
    //   c.types.filter((t) => t === "Flip").length === 0 &&
    //   c.types.filter((t) => t === "Ritual").length === 0
  );
//   const topAtk = [...cards].sort((a,b)=> b.atk-a.atk);
//   const botAtk = [...cards].sort((a,b)=> a.atk-b.atk);
//   const topdef = [...cards].sort((a,b)=> b.def-a.def);
//   const botdef = [...cards].sort((a,b)=> a.def-b.def);

//   let possiblePicks = topAtk.slice(0,5);
//   possiblePicks = possiblePicks.concat(botAtk.slice(0,5));
//   possiblePicks = possiblePicks.concat(topdef.slice(0,5));
//   possiblePicks = possiblePicks.concat(botdef.slice(0,5));
  console.log(cards.length);
  const picked = await pickCards(cards);

  addCardsToSaved(picked);
};

browseCards();
// allPossibleThings();
// best2TributeCards();
// bestNonTributeCards();
// allRitualCards();
// allFlipMonsters();
// allFusionMonsters();
