// One-off: appends the Week 6 OATCCC Coaches' Poll (dated 10/8/26) to
// src/data/oatccc-coaches-poll.json, matching the file's existing
// conventions exactly: a tied row whose CSV left RANK blank gets
// `rank: null` (not an auto-incremented number), and a literal "25'" rank
// string is preserved where the OATCCC source itself has that same typo
// two weeks running (confirmed against Week 3 and Week 5's boys-3 data).
import fs from "node:fs";

const path = "src/data/oatccc-coaches-poll.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));

// [rank-or-null-or-literal, school, points, first_place_votes-or-null]
const RAW = {
  "boys-1": [
    [1, "Springboro", 240, 12], [2, "Mentor", 228, null], [3, "Mason", 206, null],
    [4, "Olentangy Berlin", 196, null], [5, "St Xavier", 187, null], [6, "Beavercreek", 184, null],
    [7, "Gahanna Lincoln", 180, null], [8, "Thomas Worthington", 136, null], [9, "Westerville North", 135, null],
    [10, "Dublin Jerome", 128, null], [11, "Lebanon", 104, null], [12, "Milford", 98, null],
    [13, "Mass. Jackson", 74, null], [14, "Sycamore", 66, null], [15, "Olentangy Orange", 59, null],
    [16, "New Albany", 55, null], [17, "Olentangy Liberty", 43, null], [18, "Perrysburg", 35, null],
    [19, "Northmont", 34, null], [20, "Little Miami", 32, null], [21, "Dublin Coffman", 31, null],
    [22, "Kings", 22, null], [23, "Solon", 16, null], [24, "Medina", 15, null],
    [25, "Lakota West", 12, null], [26, "Pickerington North", 3, null], [27, "Centerville", 2, null]
  ],
  "boys-2": [
    [1, "Uniontown Lake", 285, 9], [2, "Hoover", 266, 2], [3, "Toledo St Francis", 264, 1],
    [4, "Bowling Green", 242, null], [5, "CVCA", 235, null], [6, "Lexington", 215, null],
    [7, "Unioto", 195, null], [8, "Loveland", 190, null], [9, "Shaker Heights", 185, null],
    [10, "Kenston", 182, null], [11, "Watterson", 170, null], [12, "Hudson", 155, null],
    [13, "Granville", 112, null], [14, "Turpin", 103, null], [15, "Revere", 100, null],
    [16, "Big Walnut", 98, null], [17, "Wadsworth", 83, null], [18, "Cloverleaf", 73, null],
    [19, "Nordonia", 69, null], [20, "Dublin Scioto", 61, null], [21, "Med. Highland", 54, null],
    [22, "Rocky River", 49, null], [23, "Syl. Northview", 47, null], [24, "DeSales", 39, null],
    [25, "Mass. Perry", 32, null], [26, "Defiance", 22, null], [27, "Salem", 18, null],
    [28, "Buckeye", 14, null], [29, "Westlake", 11, null], [30, "Carroll", 10, null],
    [31, "Bellbrook", 9, null], [32, "Syl. Southview", 8, null], [33, "Boardman", 4, null],
    [34, "Lakewood", 1, null]
  ],
  "boys-3": [
    [1, "Woodridge", 288, 12], [2, "Versailles", 263, null], [3, "West Liberty Salem", 260, null],
    [4, "Fairless", 250, null], [5, "Chagrin Falls", 245, null], [6, "Van Wert", 217, null],
    [7, "Fairfield Union", 208, null], [8, "Bryan", 207, null], [9, "Berkshire", 186, null],
    [10, "Oakwood", 178, null], [11, "Minerva", 157, null], [12, "Waynesville", 139, null],
    [13, "Elmwood", 131, null], [14, "Madeira", 124, null], [15, "Marlington", 92, null],
    [16, "Margaretta", 90, null], [17, "Upper Sandusky", 77, null], [18, "Archbold", 70, null],
    [19, "CF Northwest", 69, null], [20, "Keystone", 56, null], [21, "Norwayne", 51, null],
    [22, "CHCA", 40, null], [23, "Wyoming", 39, null], [24, "Tusc. Valley", 37, null],
    ["25'", "Waynedale", 24, null], [26, "Gilmour Academy", 22, null], [27, "Utica", 13, null],
    [28, "Paulding", 12, null], [29, "Milton Union", 10, null], [30, "Triway", 7, null],
    [31, "Hebron Lakewood", 5, null], [32, "Akron SVSM", 4, null], [33, "Fredericktown", 3, null],
    [34, "Vinton County", 2, null], [null, "Bellaire", 2, null], [null, "Liberty Benton", 2, null],
    [37, "Summit Co Day", 1, null]
  ],
  "boys-4": [
    [1, "Mount Gilead", 283, 8], [2, "Russia", 278, 4], [3, "Tinora", 267, null],
    [4, "Maplewood", 252, null], [5, "Botkins", 229, null], [6, "Legacy Christian", 224, null],
    [7, "Convoy Crestview", 220, null], [8, "Independence", 209, null], [9, "Cedarville", 198, null],
    [10, "Hicksville", 168, null], [11, "New Bremen", 148, null], [12, "Minster", 145, null],
    [13, "Sherwood Fairview", 144, null], [14, "Columbus Grove", 142, null], [15, "Lehman Catholic", 127, null],
    [16, "St Henry", 117, null], [17, "Shenandoah", 103, null], [18, "South Webster", 67, null],
    [19, "Lake Center Christian", 60, null], [20, "New Riegel", 52, null], [21, "Kid Central Christian", 40, null],
    [22, "Seneca East", 39, null], [23, "Rittman", 36, null], [24, "Black River", 20, null],
    [25, "Pettisville", 9, null], [26, "Ashland Crestview", 8, null], [27, "Liberty Center", 7, null],
    [28, "Badger", 5, null], [29, "Open Door Christian", 3, null], [30, "Fort Loramie", 1, null]
  ],
  "girls-1": [
    [1, "Milford", 240, 12], [2, "Upper Arlington", 224, null], [3, "Centerville", 190, null],
    [4, "Springboro", 188, null], [5, "Mass. Jackson", 187, null], [6, "Hilliard Davidson", 181, null],
    [7, "Oak Hills", 176, null], [8, "Mason", 145, null], [9, "Gahanna Lincoln", 137, null],
    [10, "Perrysburg", 132, null], [11, "Sycamore", 128, null], [12, "Beavercreek", 124, null],
    [13, "Stow-Munroe Falls", 82, null], [14, "Solon", 63, null], [15, "Lancaster", 62, null],
    [16, "Dublin Jerome", 61, null], [17, "Mentor", 52, null], [18, "Olentangy Berlin", 31, null],
    [19, "Northmont", 26, null], [20, "Thomas Worthington", 20, null], [21, "Westerville South", 15, null],
    [22, "Teays Valley", 14, null], [23, "Marysville", 13, null], [24, "GlenOak", 11, null],
    [25, "Olentangy Orange", 6, null], [26, "Kings", 5, null], [27, "Watkins Memorial", 4, null],
    [28, "Olentangy Liberty", 3, null], [29, "Westerville North", 2, null], [30, "Little Miami", 1, null]
  ],
  "girls-2": [
    [1, "Watterson", 287, 11], [2, "Avon", 276, 1], [3, "Aurora", 256, null],
    [4, "Canal Winchester", 255, null], [5, "Granville", 220, null], [6, "Wadsworth", 214, null],
    [7, "Syl. Southview", 186, null], [8, "Bellbrook", 177, null], [9, "Fremont Ross", 171, null],
    [10, "Hudson", 170, null], [11, "Shaker Heights", 156, null], [12, "Bay", 144, null],
    [13, "Big Walnut", 131, null], [14, "Med. Highland", 129, null], [15, "Turpin", 124, null],
    [16, "Cle. St Joseph Academy", 113, null], [17, "Westlake", 102, null], [18, "Brecksville", 92, null],
    [19, "CVCA", 90, null], [20, "Boardman", 76, null], [21, "Cin. St Ursula", 68, null],
    [22, "Bowling Green", 41, null], [23, "Tol. St Ursula", 37, null], [24, "Indian Hill", 25, null],
    [25, "Tallmadge", 17, null], [26, "Lexington", 16, null], [27, "Steele", 12, null],
    [28, "Revere", 11, null], [29, "Harrison", 8, null], [30, "Loveland", 3, null],
    [31, "Celina", 2, null], [32, "Anthony Wayne", 1, null]
  ],
  "girls-3": [
    [1, "Huron", 287, 9], [2, "Minerva", 271, 3], [3, "Oakwood", 270, null],
    [4, "Ottawa Glandorf", 254, null], [5, "Marlington", 230, null], [6, "Woodridge", 227, null],
    [7, "Berkshire", 194, null], [8, "Versailles", 190, null], [9, "Crestwood", 187, null],
    [10, "Van Wert", 177, null], [11, "Madeira", 164, null], [12, "Salem", 154, null],
    [13, "Indian Valley", 142, null], [14, "Napoleon", 127, null], [15, "Hathaway Brown", 115, null],
    [16, "Akron SVSM", 100, null], [17, "Tusc. Valley", 86, null], [18, "Fairfield Union", 82, null],
    [19, "CF Northwest", 81, null], [20, "Northmor", 57, null], [21, "Shelby", 51, null],
    [22, "Claymont", 35, null], [23, "Bellevue", 25, null], [24, "Chagrin Falls", 22, null],
    [25, "Fenwick", 21, null], [26, "Coldwater", 18, null], [27, "West Holmes", 13, null],
    [28, "Bath", 8, null], [29, "Galion", 5, null], [30, "Waynesville", 4, null],
    [31, "Fairless", 1, null], [null, "Milton Union", 1, null], [null, "Vinton County", 1, null]
  ],
  "girls-4": [
    [1, "Ottawa Hills", 288, 12], [2, "Minster", 270, null], [3, "Grandview Heights", 267, null],
    [4, "Liberty Center", 243, null], [5, "Rittman", 241, null], [6, "Kirtland", 235, null],
    [7, "Maplewood", 205, null], [8, "McDonald", 197, null], [9, "Fort Loramie", 195, null],
    [10, "Bellaire", 181, null], [11, "West Liberty Salem", 179, null], [12, "Summit Country Day", 143, null],
    [13, "Mount Gilead", 137, null], [14, "Archbold", 132, null], [15, "Dayton Christian", 104, null],
    [16, "Milan Edison", 101, null], [17, "Tinora", 73, null], [18, "Lincolnview", 64, null],
    [19, "Mechanicsburg", 59, null], [20, "Ash. St John", 51, null], [21, "Sherwood Fairview", 50, null],
    [22, "Crestline", 42, null], [23, "Margaretta", 39, null], [24, "Cedarville", 37, null],
    [25, "Newton", 21, null], [26, "Carey", 16, null], [27, "Seneca East", 12, null],
    [28, "Riverdale", 10, null], [29, "Botkins", 5, null], [30, "Anna", 3, null],
    [31, "Fairbanks", 2, null]
  ]
};

function rowsFor(key) {
  return RAW[key].map(([rank, school, points, first_place_votes]) => ({ rank, school, points, first_place_votes }));
}

const week6 = {
  pollLabel: "Week 6 Poll",
  pollDate: "2026-10-08",
  divisions: {
    boys: { "1": rowsFor("boys-1"), "2": rowsFor("boys-2"), "3": rowsFor("boys-3"), "4": rowsFor("boys-4") },
    girls: { "1": rowsFor("girls-1"), "2": rowsFor("girls-2"), "3": rowsFor("girls-3"), "4": rowsFor("girls-4") }
  }
};

data.weeks.push(week6);
fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log("Added", week6.pollLabel, "-- total weeks now:", data.weeks.length);
