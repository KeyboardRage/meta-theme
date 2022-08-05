# Meta
A CSS/JavaScript (Stylish/Tampermonkey) theme for V3rmillion.net

## Features
* 🎨 Not just re-coloured, but also stylized (*you can re-colour it to your linking too*)
* ❤ Automatically initialized first-time setup guide
* ✨ Design following the meta trend of everything glass and rounded style :^)
* ⚜ Custom logo that changes colour along with your theme
* 🆎 Automatically picks text colour (*black or white*) for best contrast based on your theme color
* 🔅 Automatically creates lighter tint and darker shade of theme colour
* 🗂 Thread prefixes are colour coded and tagged with classes (*if you want to customize them more*)
* 👤 Postbit profiles are HTML structured (*again, if you want to customize them more*)
* 🧰 API exposed, allowing you to customize it using console or your own scripts
  * 💾 Saves changes made
  * ⚡ Updates live, no need to reload
  * 🧾 Documented code for the JavaScript (*JSDoc + comments*) and CSS (*comments*)

## Requirements
You need two browser extensions for this theme to work:
* **JavaScript**: [Tempoermonkey](https://www.tampermonkey.net/) (*or similar*)
* **CSS**: Stylish / Stylus / Userstyles

## Installation
1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
1. Go to V3rmillion.net
1. While on the website; click the Tampermonkey extension and make sure Tampermonkey is enabled, then select "Create a new script..."  
![image](https://user-images.githubusercontent.com/40437596/183116232-7f70741f-fd53-40fd-a417-0f1d7e3c2a6d.png)
1. Replace the existing content with that of the [Script.js](./Script.js)
1. Save the Tampermonkey document (*CTRL+S*)
1. Navigate back to V3rmillion.net and reload the page
1. Follow instructions presented below the logo

## Images
![image](https://user-images.githubusercontent.com/40437596/183118576-d0ac5681-a492-4196-9506-7785e8cc39ea.png)  

![image](https://user-images.githubusercontent.com/40437596/183118653-19c8f7ef-baec-4cfe-adc1-46ab3a17c06f.png)  

![image](https://user-images.githubusercontent.com/40437596/183118715-286f7e7a-7571-42d8-883e-59585d2ca48c.png)  

![image](https://user-images.githubusercontent.com/40437596/183119797-4d450591-274b-45b7-aed6-f7531d41535e.png)

## Documentation
You can use the browser console in order to access a global variable `theme` in order to customize your theme, either through commands, or through your own script.

### Colours
You can change many colours to your liking.
```js
theme.colors;
/*
Produces a list of colors you can change, and their current value:
accent: "#8a7547"
accent_dark: "#766133"
accent_light: "#947f51"
accent_slight: "#8a75471f"
bg: "#121215"
bg_dark: "#000001"
bg_light: "#1c1c1f"
border: "#ffffff"
card: "#ffffff0a"
green: "#2edc5b"
green_slight: "#2edc5b1f"
over_accent: "#ffffff"
over_lighter: "#ffffff08"
red: "#cd1818"
red_slight: "#cd18181f"
rep_negative: "#cd1818"
rep_neutral: "#cdcdcd"
rep_positive: "#18cd18"
slight: "#ffffff30"
text: "#929292"
user_banned: "#cccccc"
user_group: "#8a7547"
user_normal: "#8a7547"
user_staff: "#cd1818"
user_unconfirmed: "#cccccc"
user_upgraded: "#8a7547"
*/
```

Most people will likely want to change the main theme colour, which is called `accent`:
```js
theme.colors.accent = "#cd18181" // Changes theme colour to the default V3rmillion red
```

You can read the source-code if you want further explanation of what exactly each possible color is.

### Effects
Effects are some stylistic flavour of the design; for now that is the blur amount and shadows.
```js
theme.effects
/*
Produces:
blur: "blur(16px)"
shadow: "0 2px 4px rgba(0,0,0,.1),0 4px 8px rgba(0,0,0,.1),0 8px 16px rgba(0,0,0,.1)"
*/

theme.effects.blur = "blur(8px)" // Halves the blur amount
```

### Custom logo
By default, the theme will switch to a slightly altered logo that will always have the theme color.  
You can also use a custom logo of your own easily too, and revert back to the original one.
```js
theme.setLogoSVG() // Changes to the Meta logo that changes colour
theme.setLogoImage() // Changes to the default logo
theme.setLogoImage("https://full.image/link.png") // Change to a custom logo
```
