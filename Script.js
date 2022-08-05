// ==UserScript==
// @name         Meta Theme Editor
// @namespace    https://v3rmillion.net
// @match        https://v3rmillion.net/*
// @version      0.2
// @description  A theme loader and editor for the Meta theme
// @author       VirtusGraphics
// @icon         https://www.google.com/s2/favicons?domain=v3rmillion.net
// @run-at       document-start
// ==/UserScript==

window.requestAnimationFrame(()=>{
	// Load CSS fast as possible if available
	if (window.localStorage.getItem("meta_css")) {
		const style = document.createElement("STYLE");
		style.textContent = window.localStorage.getItem("meta_css");
		document.body.append(style);
		style.setAttribute("type", "text/css");
		style.setAttribute("id", "meta_theme");
	}
});

// Prepare the theme API as soon as HTML is loaded
document.addEventListener("DOMContentLoaded", () => {
class MetaTheme {
	constructor(data) {
		this.colors = new Proxy({
			// Main accent color
			accent: data.colors.accent,
			// Lighter tint of accent color (generated)
			accent_light: MetaTheme.adjustColor(data.colors.accent, 10),
			// Darker shade of accent color (generated)
			accent_dark: MetaTheme.adjustColor(data.colors.accent, -20),
			// Accent color with low opacity, to be used as background mostly
			accent_slight: data.colors.accent + "1f",

			// Background color
			bg: data.colors.bg,
			// Lighter version of background color (generated)
			bg_light: MetaTheme.adjustColor(data.colors.bg, 10),
			// Darker version of background color (generated)
			bg_dark: MetaTheme.adjustColor(data.colors.bg, -20),
			// The color of floating cards
			card: data.colors.card,

			// Border color
			border: data.colors.border,
			// Slightly white, overlays over background
			slight: data.colors.slight,

			// Main text color in threads etc.
			text: data.colors.text,
			// Slightly white over darker BG's
			over_lighter: data.colors.over_lighter,
            // Color for content over accent (generated)
            over_accent: data.colors.over_accent,

			// Reputation
			rep_positive: data.colors.rep_positive,
			rep_negative: data.colors.rep_negative,
			rep_neutral: data.colors.rep_neutral,

			// Color of usernames
			user_banned: data.colors.user_banned,
			user_unconfirmed: data.colors.user_unconfirmed,
			user_normal: data.colors.user_normal,
			user_staff: data.colors.user_staff,
			user_group: data.colors.user_group,
			user_upgraded: data.colors.user_upgraded,

			// Other negatives: downlikes, logout, etc.
			red: data.colors.red,
			red_slight: data.colors.red+"1f",
			// Other positives: likes,
			green: data.colors.green,
			green_slight: data.colors.green+"1f",
		}, {
			get(target, prop) {
				return target[prop];
			},
			set(target, prop, value) {
				if (!(prop in target)) throw new Error(`Unknown color '${prop}'`);
				if (prop.endsWith("_dark") || prop.endsWith("_light") || prop.endsWith("_slight")) throw new Error(`Cannot directly modify adjacent colors. They are automatically generated when base is changed.`);
				target[prop] = value;

				// Search for slight variants and auto-adjust them
				if (`${prop}_light` in target) target[`${prop}_light`] = MetaTheme.adjustColor(value, 10);
				if (`${prop}_dark` in target) target[`${prop}_dark`] = MetaTheme.adjustColor(value, -20);
				if (`${prop}_slight` in target) target[`${prop}_slight`] = value+"1f";
				target.over_accent = MetaTheme.bestAccentForegroundColor(target.accent, target);

				theme.saveCSS();
				theme.updateCSS();
				theme.saveConfig();
			},
			ownKeys(target) {
				return Reflect.ownKeys(target);
			}
		});

		this.effects = new Proxy({
			// The default blur radius used for frosted glass
			blur: data.effects.blur,
			// The default shadow for floating cards
			shadow: data.effects.shadow
		}, {
			get(target, prop) {
				return target[prop];
			},
			set(target, prop, value) {
				if (!(prop in target)) throw new Error(`Unknown effect: '${prop}'`);
				target[prop] = value;

				theme.saveCSS();
				theme.updateCSS();
				theme.saveConfig();
			},
			ownKeys(target) {
				return Reflect.ownKeys(target);
			}
		});

		// HTML parser
		const p = new DOMParser();
		/**
		 * Parses HTML string into actual HTML
		 * @param {String}
		 * @returns {Element}
		 */
		this.htmlParse = html => p.parseFromString(html, "text/html").body.firstChild;

		this.logo = {
			elm: this.htmlParse(data.logo.elm),
			container: () => document.getElementById("logo").firstElementChild,
			replace: (elm) => {
				this.logo.elm = elm;
				this.logo.container().firstElementChild.replaceWith(elm);
			},
		};
		this.logo.container().firstElementChild.replaceWith(this.logo.elm);

		// Flag values
		this.flags = data.flags || 0;

		// Map of flags
		this._flags = {
			css_installed:      1<<0,
			classic_postbit: 	1<<1,
		};

		/**
		 * A list of extensions users can use for the CSS
		 * @prop {Array<Array<String>>}
		 */
		this.exts = [
			["Custom", "", ""],
			["Stylish","fjnbnpbmkenffdnngjfgmeleoegfcffe","https://userstyles.org/"],
			["Stylus","clngdbkpkpeebahjckkjfobafhncgmne","https://userstyles.world/"],
		];
		/**
		 * The extension user have installed and is using. Number is index of 'this.exts'
		 * @prop {Number}
		 */
		this.hasExt = data.hasExt || -1;
	}

	/**
	 * Calculate and return the best option of a color to go over the current accent color
	 * @param {String} accentColor The current accent color
	 * @returns {String} A hex string with pound prefix
	 */
	static bestAccentForegroundColor(accentColor, possibleColors) {
		/**
		 * Pre-defined dark and light colors that should be possible over an accent color.
		 */
		let possible = ["#f9f9f9","#242424"];

		/**
		 * These colors can be defined to allow custom dark/light accent colors,
		 * and have the code find the best between them.
		 */
		if (Object.keys(possibleColors).some(name => name.startsWith("over_accent_custom_"))) {
			possible = Object.keys(possibleColors)
				.filter(name => name.startsWith("over_accent_custom_"))
				.map(name => possibleColors[name]);
		}

		return possible
			.map(hex => MetaTheme.contrastCheck(hex, accentColor))
			.sort((curr,prev) => prev.result-curr.result)[0].colorA.hex;
	}

	/**
	 * A set of methods to run every time a page loads
	 */
	runDOMManipulatior() {
		if (!this.getFlag("css_installed")) return this.installation();

    	console.time("[Meta] DOM modified in");

		this.__noInlineCSSOrClass();
		this.__fixBreadcrumbs();
		if (window.location.href.includes("/forumdisplay.php") || window.location.pathname === "/search.php") this.__threadLabels();
		if (window.location.href.includes("/showthread.php")) {
			this.__moveOnlineStatus();
			this.__organizeAwards();
			this.__posts();
			this.__organizePostbitStats();
		}
        if (window.location.pathname==="/newthread.php" || window.location.pathname==="/newreply.php") {
            this.__injectWysiwigCSS();
        }

		console.timeEnd("[Meta] DOM modified in");
	}

	/**
	 * Sets postbit mode to classic or top. Postbit is where user data is listed in a thread post. Top or on the side.
	 * @param {'classic'|'top'} mode The mode to set
	 * @async
	 */
	async setPostbitMode(mode) {
		if (mode==="classic") mode = "1";
		else if (mode==="top") mode = "0";
		else throw new Error(`Unknown postbit mode: '${mode}'`);

		fetch("https://v3rmillion.net/usercp.php?action=options")
            .then(res => res.text())
            .then(res => {
	            let d = new DOMParser().parseFromString(res, "text/html");
	            let f = new FormData(d.querySelector("form"));
	            let str = String();

	            for(let key of f.entries()) {
	                if (key[0]==="classicpostbit") continue;
	                str += `${key[0]}=${key[1]}&`;
	            }
	            str += "classicpostbit="+mode;

	            return fetch("/usercp.php", {
	                method: "POST",
	                credentials: "same-origin",
	                headers: {
	                    "Content-Type":"application/x-www-form-urlencoded",
	                    "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
	                    "sec-fetch-dest":"document",
	                    "sec-detch-mode":"navigate",
	                    "sec-fetch-user": "?1"
	                },
	                body: str
	            });
        	});
	}

	/**
	 * Sets a bitflag value
	 * @param {String} flag A flag value to modify
	 * @param {Boolean} boolean The value to set it to
	 * @returns {Boolean}
	 */
	async setFlag(flag, boolean) {
		if (!(flag in this._flags)) throw new Error(`Unknown flag: '${flag}'`);
		if (boolean) this.flags |= this._flags[flag];
		else this.flags = this.flags & ~this._flags[flag];

		this.saveConfig();
		return !!boolean;
	}

	/**
	 * Check if a bitflag value is set
	 * @param {String} flag The flag to check
	 * @returns {Boolean}
	 */
	getFlag(flag) {
		if (!(flag in this._flags)) throw new Error(`Unknown flag: '${flag}'`);
		return !!(this.flags & this._flags[flag]);
	}

	/**
	 * Saves the current theme config to localStorage
	 */
	saveConfig() {
		window.localStorage.setItem("meta_config", JSON.stringify(this.toObject()));
	}

	/**
	 * Saves the current settings as CSS into localStorage
	 */
	saveCSS() {
		window.localStorage.setItem("meta_css", this.toCSS());
	}

	/**
	 * Loads the parsed CSS from LocalStorage and applies it to the document
	 */
	updateCSS() {
		const style = document.getElementById("meta_theme");
		if (style) style.textContent = this.toCSS();

        // Update WYSIWYG too
        this.__injectWysiwigCSS();
	}

	/**
	 * Converts the settings to CSS
	 * @returns {String}
	 */
	toCSS() {
		let container = `:root{`;
		for (const key in this.colors) container += `--${key}:${this.colors[key]};`;
		for (const key in this.effects) container += `--${key}:${this.effects[key]};`;
		return container+"}";
	}

	/**
	 * Return this theme instance as an object
	 * @returns {Object}
	 */
	toObject() {
		const logo = {
			elm: this.logo.elm.outerHTML
		};

		return {
			colors: this.colors,
			effects: this.effects,
			flags: this.flags,
			logo
		};
	}

	/**
	 * Manipulator:
	 * Remove inline CSS and classes from DOM
	 */
	__noInlineCSSOrClass() {
		let classList = [
	        ['#content > div[style="border-radius:5px;max-height:100px;overflow:auto;"]',"users_browsing"],
	        ['.post_author'],
	        ['.post.classic .post_content'],
	        ['.post_content', "_post_container"],
	        ['[id^="like_buttons"] > div', "like_post"],
	        ['[id^="like_buttons"] > div:nth-child(2)', "dislike_post"],
	        ['[id^="like_buttons"] > div:nth-child(3)', "post_ratings"],
	        ['.usercp_container img']
	    ];

	    for (let i=0;i<classList.length;i++) {
	        if (document.querySelectorAll(classList[i][0]).length) {
	            for (const elm of document.querySelectorAll(classList[i][0])) {
	            	if (classList[i][1]) elm.classList.add(classList[i][1]);
	                elm.removeAttribute("style");
	            }
	        }
	    }
	}

	/**
	 * Manipulator:
	 * Changes the layout of the breadcrumbs
	 */
	__fixBreadcrumbs() {
		// Purge breadcrumbs to be clean. It's buggy AF so no idea why it need multiple passes.
	    let elm = document.querySelector(".navigation").children;
	    for (let i=0;i<elm.length;i++) if (elm[i].constructor.name !== "HTMLSpanElement" && elm[i].constructor.name !== "HTMLAnchorElement") {elm[i].remove();continue;}
	    elm = document.querySelector(".navigation").childNodes;
	    for (let i=0;i<elm.length;i++) if (elm[i].constructor.name !== "HTMLSpanElement" && elm[i].constructor.name !== "HTMLAnchorElement") {elm[i].remove();continue;}
	    for (let i=0;i<elm.length;i++) if (elm[i].constructor.name !== "HTMLSpanElement" && elm[i].constructor.name !== "HTMLAnchorElement") {elm[i].remove();continue;}
	}

	/**
	 * Manipulator:
	 * Detect and convert thread labels/tags, like [DISCUSSION] etc., and remove brackets, and add a class for its type
	 */
	__threadLabels() {
        const nodeList = Array();
        if (window.location.pathname==="/search.php") {
            nodeList.push(...Array.from(document.querySelectorAll("#content > table td span")));
        } else {
            nodeList.push(...Array.from(document.querySelectorAll(".forumdisplay_regular > div > span")));
            nodeList.push(...Array.from(document.querySelectorAll(".forumdisplay_sticky > div > span")));
        }

        function makeTag(tagName,position) {
            const elm = document.createElement("div");
	        elm.classList.add("thread_tag");
            elm.classList.add(`tag_${tagName.toLowerCase()}`);
            elm.textContent = tagName;
            return elm;
        }

	    for(const thread of nodeList) {
            if(thread.childNodes[2] && thread.childNodes[2].nodeType==3 && thread.childNodes[2].textContent.search(/\w/)!==-1) {
                thread.childNodes[2].textContent = thread.childNodes[2].textContent.replace(/\W/g,"");
                const elm = makeTag(thread.childNodes[2].textContent, thread.childNodes[2]);
                thread.removeChild(thread.childNodes[2])
                thread.insertBefore(elm, thread.childNodes[2]);
            }

             if (thread.childNodes[0] && thread.childNodes[0].nodeType==3 && thread.childNodes[0].textContent.search(/\w/)!==-1) {
	            const tags = thread.childNodes[0].textContent.split(":").map(t => t.replace(/\W/g,"").trim());
                thread.removeChild(thread.childNodes[0]);
                tags.forEach(tag => {
                    const elm = makeTag(tag);
                    thread.prepend(elm)
                    console.log(elm)
                });
	        }
	    }
	}

	/**
	 * Manipulator:
	 * Organizes the awards and gives them their own class
	 */
	__organizeAwards() {
		// Set award class
		for (const elm of document.querySelectorAll(".author_statistics")) {
			const x = document.createElement("div");
	        x.classList.add("awards");

	        const stuff = Array();
	        for (const node of elm.childNodes) {
	        	if (node.nodeType===1 && node.href && node.href.startsWith("https://v3rmillion.net/awards.php"))
	        		x.append(node);
	        }
	        elm.appendChild(x);
		}
	}

	/**
	 * Manipulator:
	 * Moves the Online indicator into its own div, and appends class based on status
	 */
	__moveOnlineStatus() {
	    for(let elm of document.querySelectorAll(".author_information")) {
	        const node = document.createElement("div");
	        node.classList.add("online_status");
	        node.classList.add(elm.childNodes[2].textContent.includes("online") ? "user_online" : "user_offline");
	        node.appendChild(elm.childNodes[2]);
	        elm.parentNode.parentNode.prepend(node);
	    }
	}

	/**
	 * Manipulator:
	 * Performs various small changes to posts
	 */
	__posts() {
		// Remove 'Direct link' part in posts
		document.querySelectorAll(".post_head .postlink").forEach(e=>e.textContent=e.textContent.toString().replace(" (Direct Link)",""));
	}

	/**
	 * Manipulator:
	 * Organizes postbit stats into a list and give them their own classes
	 */
	__organizePostbitStats() {
		for (const elm of document.querySelectorAll(".author_statistics")) {
            const r = elm.textContent
	            .split(/:|\n/)
	            .map(e=>e.trim())
	            .filter(e=>!isNaN(parseInt(e.slice(-1)))||e.endsWith("%"));

            const x = this.htmlParse(`<div class="author_statistics"><dl>
	            <dt class="stat_posts title">Posts</dt>
	            <dd class="stat_posts value">${r[0]}</dd>
	            <dt class="stat_threads title">Threads</dt>
	            <dd class="stat_threads value">${r[1]}</dd>
	            <dt class="stat_joined title">Joined</dt>
	            <dd class="stat_joined value">${r[2]}</dd>
	            <dt class="stat_rep title">Reputation</dt>
	            <dd class="stat_rep value ${r[3]>0?"positive":r[3]<0?"negative":"neutral"}"><a href="${elm.querySelector("a").href}">${r[3]}</a></dd>
	            ${r[4] ? `<dt class="stat_warn title">Warning lvl</dt><dd class="stat_warn value${r[4].slice(-1)>0?` level_${r[4].slice(-1)}`:""}">${r[4]}</dd>` : ""}</dl></div>`, "text/html");

            if (elm.querySelector(".awards")) x.appendChild(elm.querySelector(".awards"));
            elm.innerHTML = "";
            elm.appendChild(x);
		}
	}

    /**
     * Manipulator:
     * Injects custom CSS into the WYSIWIG editor
     */
    __injectWysiwigCSS() {
        // Skip a cycle to let website inject WYSIWIG via JS first
        setTimeout(()=>{
            const w = document.querySelector(".sceditor-container iframe");
            if (!w) return;

            const doc = w.contentDocument;
            const s = doc.createElement("style");
            s.id = "meta-variables";
            s.textContent = this.toCSS() + `html, body, p, code:before, table {color: var(--text);}`;
            doc.head.append(s);
        }, 0);
    }

	/**
	 * Initializes the installation procedure/guide
	 */
	installation() {
		// Try Chrome extension checker
		if ("chrome" in window) {
			for (const i in this.exts) {
				try {
					chrome.runtime.sendMessage(ext[i][1],"");
					this.hasExt = parseInt(i);
					break;
				} catch(_) {}
			}
			if (this.hasExt >= 0) return this._installViaPlugin(this.hasExt);
		}

		return this._promptInstallPlugin();
	}

	_promptInstallPlugin() {
		const style = document.createElement("STYLE");
		style.id = "meta_install_css";
		style.textContent = ".meta_install{text-align:center;padding:1em;border:solid thin yellow;width:fit-content;margin:0 auto;border-radius:4px;background-color:#ffff000a;}.meta_install li{text-align:left;}"
            + (document.body.background ? "" : ".meta_install a{color:blue;}.meta_install button {background:#0000001c !important}");
		document.querySelector("body").appendChild(style);

		const x = this.htmlParse(`<div class="meta_install">
			<p>The Meta theme uses both CSS and JavaScript to function properly.</p>
			<p>The script cannot detect any browser extension that modifies website CSS.</p>
			<p>Please select an option that best describe your case:</p>
			<select>
				<option selected disabled>-- Pick an option --</option>
				<option value="2">I have Stylus installed (userstyles.world)</option>
				<option value="1">I have Stylish installed (userstyles.org)</option>
				<option value="0">I use something else for custom CSS</option>
				<option value="-1">I have nothing / need to install something</option>
			</select>
		</div>`);
		document.getElementById("header").append(x);
		x.addEventListener("input", e => {
			x.remove();
			this._installViaPlugin(parseInt(e.target.value));
		}, {once: true, capture: true});
	}

	_installViaPlugin(extIndex) {
		/**
		 * 1. Prompt button to go to install
		 * 2. Once you click, store in config that you picked one
		 */
		let container = this.htmlParse(`<div class="meta_install">
				<p><i>Wrong option? Just reload the website.</i></p>
				<p>You now need to install the CSS to complete the setup.</p>
			</div>`);
		switch(extIndex) {
			// User have nothing
			case -1: {
				container.appendChild(this.htmlParse(`<div>
					<p>What you need is a browser extension that changes the website you visit's CSS, then you need to install the CSS theme.</p>
					<p>The easiest way to do this is to use the Stylus extension. Follow the instructions bellow.</p>
					<ol>
						<li>Go to the extension website: <a href="https://chrome.google.com/webstore/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne" taget="_blank">Chrome/Chromium/Opera/Vivaldi</a> | <a href="https://addons.mozilla.org/firefox/addon/styl-us/" taget="_blank">Firefox</a></li>
						<li>Install the extension.</li>
						<li><a href="https://userstyles.world/style/5986/meta" target="_blank">Click here</a> to go to the website for the theme.</li>
						<li>Click the 'Install' button there.</li>
						<li>Copy all the code there.</li>
						<li>While having v3rmillion website open, click the extension icon (looks like '{S}').</li>
						<li>Click the text "Write style for: v3rmillion.net" (⚠ NOT the '/this URL' part of it).</li>
						<li>In the large open text area, paste the code you copied and click 'Save'.</li>
						<li>Click the "I have installed it" button bellow to complete setup.</li>
					</ol>
				</div>`));
				break;
			}
			// User have custom CSS
			case 0: {
				container.appendChild(this.htmlParse(`<div>
					<ol>
						<li>Please go to this link to get the CSS: <a href="https://github.com/KeyboardRage/meta-theme/raw/main/Script.js" target="_blank">https://github.com/KeyboardRage/meta-theme/raw/main/Script.js</a></li>
						<li>Copy and paste it into whatever CSS modifying extension you're using.</li>
						<li>Click the "I have installed it" button bellow to complete setup.</li>
					</ol>
				</div>`));
				break;
			}
			// User have Stylish
			case 1: {
				container.appendChild(this.htmlParse(`<div>
					<p>Unfortunately Userstyles.org does not want to validate the CSS, and the theme can therefore not be published on this platform.</p>
					<p>I would recommend switching to Stylus instead:  <a href="https://chrome.google.com/webstore/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne" taget="_blank">Chrome/Chromium/Opera/Vivaldi</a> | <a href="https://addons.mozilla.org/firefox/addon/styl-us/" taget="_blank">Firefox</a>.</p><ol>
					<p>Once you have installed that plugin, reload this page and follow the setup guide again, but selecting the "Stylus" option instead.</p>
				</div>`));
				break;
			}
			// User have Stylus
			case 2: {
				container.appendChild(this.htmlParse(`<div>
					<ol>
						<li><a href="https://userstyles.world/" target="_blank">Click here</a> to go to the website for the theme.</li>
						<li>Click the blue 'Install' button there.</li>
						<li>Copy all the code there.</li>
						<li>While having v3rmillion website open, click the extension icon (looks like '{S}').</li>
						<li>Click the text "Write style for: v3rmillion.net" (⚠ NOT the '/this URL' part of it).</li>
						<li>In the large open text area, paste the code you copied and click 'Save'.</li>
						<li>Click the "I have installed it" button bellow to complete setup.</li>
					</ol>
				</div>`));
				break;
			}
			default:
				throw new Error(`Unknown extension option index: ${extIndex}`);
		}

		const doneButton = this.htmlParse(`<button>I have installed it</button>`);
		doneButton.addEventListener("click", () => {
			container.remove();

			this.hasExt = extIndex;
			this.setFlag("css_installed", true);
			this.saveConfig();
			this.saveCSS();
			this.updateCSS();
			document.getElementById("meta_install_css").remove();
			window.location.reload();
		}, {once: true, capture: true});

		container.appendChild(doneButton);
		document.getElementById("header").append(container);
	}

	/**
	 * Performs a WCAG contrast check between two colors. Returns a set of scores
	 * @param {String} hexBg The hex color of the background
	 * @param {String} hexForeground The hex color of the foreground that goes on background
	 * @return {{result:Number, colorA:{r:Number,g:Number,b:Number,hex:String}, colorB:{r:Number,g:Number,b:Number,hex:String}}
	 */
	static contrastCheck(hexBg, hexForeground) {
		const rgbBg = MetaTheme.hexToRGB(hexBg);
		const rgbForeground = MetaTheme.hexToRGB(hexForeground);

		/**
		 * Takes in a RGB object to do some calculations on.
		 * @param {{r:Number, g:Number, b:Number}} input RGB values
		 * @returns {Number} A value you use for further calculation
		 */
		const calc = (input) => {
			for (let key in input) {
				input[key] = input[key] / 255;
				if (input[key] <= 0.03928) {
					input[key] = input[key] / 12.92;
				} else {
					input[key] = Math.pow((input[key] + 0.055) / 1.055, 2.4);
				}
			}
			return 0.2126 * input.r + 0.7152 * input.g + 0.0722 * input.b;
		};

		/**
		 * Check contrasts after calculations.
		 * @returns {Number} The final contrast value
		 */
		const vals = {
			a: calc(rgbBg),
			b: calc(rgbForeground)
		};

		return {
			// True = A is lighter, False if B is
			result: vals.a > vals.b ? (vals.a + 0.05) / (vals.b + 0.05) : (vals.b + 0.05) / (vals.a + 0.05),
			colorA: {
				...rgbBg,
				hex: hexBg
			},
			colorB: {
				...rgbForeground,
				hex: hexForeground
			},
		};
	}

	/**
	 * Performs a WCAG contrast check between two colors. Returns a set of scores
	 * @param {String} hexBg The hex color of the background
	 * @param {String} hexForeground The hex color of the foreground that goes on background
	 * @return {Object}
	 */
	contrastCheck(hexBg, hexForeground) {
		return MetaTheme.contrastCheck(hexBg, hexForeground);
	}

	/**
	 * Converts HEX to RGB
	 * @param {String} hex The hex code
	 * @returns {{r:Number, g:Number, b:Number}}
	 */
	static hexToRGB(hex) {
		const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
		hex = hex.replace(shorthandRegex, function(m, r, g, b) {
			return r + r + g + g + b + b;
		});

		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	/**
	 * Converts RGB values to HEX string with pound prefix
	 * @param {{r:Number, g:Number, b:Number}}
	 * @returns {String}
	 */
	static rgbToHex(rgb) {
		return "#" + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1);
	}

	/**
	 * Adjust color lighter or darker
	 * @param {String} colorHex The source HEX color
	 * @param {Number} amount Adjustment amount. Positive for lighter, negative for darker.
	 * @returns {String} The new HEX color
	 */
	static adjustColor(colorHex, amount) {
	    let usePound = false;
	    if (colorHex[0] == "#") {
	        colorHex = colorHex.slice(1);
	        usePound = true;
	    }
	    let num = parseInt(colorHex,16);
	    let r = (num >> 16) + amount;
	    if (r > 255) r = 255;
	    else if  (r < 0) r = 0;
	    let b = ((num >> 8) & 0x00FF) + amount;
	    if (b > 255) b = 255;
	    else if  (b < 0) b = 0;
	    let g = (num & 0x0000FF) + amount;
	    if (g > 255) g = 255;
	    else if (g < 0) g = 0;
	    return (usePound?"#":"") + String("000000" + (g | (b << 8) | (r << 16)).toString(16)).slice(-6);
	}

	/**
	 * Adjust color lighter or darker
	 * @param {String} colorHex The source HEX color
	 * @param {Number} amount Adjustment amount. Positive for lighter, negative for darker.
	 * @returns {String} The new HEX color
	 */
	adjustColor(colorHex, amount) {
	    return MetaTheme.adjustColor(colorHex, amount);
	}

	/**
	 * Get the default config for new users.
	 * JSON.parse() is faster than creating plain JS object
	 */
	static get defaultConfig() {
		return JSON.parse(`{"colors":{"accent":"#8a7547","bg":"#121215","border":"#ffffff","slight":"#ffffff30","card":"#ffffff0a","text":"#929292","over_lighter":"#ffffff08","over_accent":"#ffffff","rep_positive":"#18cd18","rep_negative":"#cd1818","rep_neutral":"#cdcdcd","user_banned":"#cccccc","user_normal":"#8a7547","user_staff":"#cd1818","user_group":"#8a7547","user_upgraded":"#8a7547","user_unconfirmed":"#cccccc","red":"#cd1818","green":"#2edc5b"},"effects":{"blur":"blur(16px)","shadow":"0 2px 4px rgba(0,0,0,.1),0 4px 8px rgba(0,0,0,.1),0 8px 16px rgba(0,0,0,.1)"},"flags":0,"logo":{"elm":"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -40 715 200' height='140px' width='90%'><path d='M74.3 2L47.5 142H26.7L0 2h21l15.6 95.9.5 12c-.1-2.7.1-6.7.5-12L53.4 2h20.9zm69.6 139h-58V1h58v19h-37v41h32v18h-32v44h37v18zm86.5 0h-21.9l-23.6-64.5V64h21V19h-26v122h-21V1h55.4c8.4 0 12.6 4.3 12.6 12.9v50.9c0 5.9-2 9.7-6 11.5-2.1.9-6.7 1.3-13.6 1.3l23.1 63.4zm97.5 0h-20V72.4c-.1-3.6.3-8.7 1.1-15.2L291 129h-10.7l-18.2-71.8 1.8 15.2V141h-21V1h19.9l22.1 77.4c.2.8.4 3 .5 6.4 0-1.5.2-3.6.5-6.4L308.1 1H328v140zm38 0h-21V1h21v140zm72 0h-55V1h21v122h34v18zm68 0h-55V1h21v122h34v18zm34 0h-21V1h21v140zm88-12.8c0 8.5-4.3 12.8-12.8 12.8h-45.7c-8.3 0-12.5-4.3-12.5-12.8V13.9c0-8.6 4.2-12.9 12.5-12.9h45.7c8.5 0 12.8 4.3 12.8 12.9v114.3zm-21-5.2V19h-29v104h29zm108 18h-18.4l-32.9-88.1c.9 4.3 1.3 7.7 1.3 10.1v78h-20V1h18.4l32.9 86.3c-.9-4.3-1.3-7.7-1.3-10.1V1h20v140z' fill='var(--accent)'></path></svg>"}}`);
	}

	/**
	 * Factory reset theme, in case user mess something up
	 */
	reset() {
		window.localStorage.removeItem("meta_css");
		window.localStorage.removeItem("meta_config");
		window.location.reload();
	}

	/**
	 * Changes logo header to an image by given URL. Leave empty to set to default logo
	 * @param {String} [imageUrl] New image header. Empty for default logo
	 */
	setLogoImage(imageUrl) {
		if (!imageUrl) imageUrl = "https://v3rmillion.net/images/logo.png";

		if (this.logo.elm.tagName==="IMG") {
			this.logo.elm.src = imageUrl;
			return this.saveConfig();
		}

		const node = document.createElement("IMG");
		node.src = imageUrl;
		this.logo.replace(node);
		return this.saveConfig();
	}

	/**
	 * Changes logo header to the SVG one
	 */
	setLogoSVG() {
		if (this.logo.elm.tagName==="svg") return;

		const node = document.createElementNS("http://www.w3.org/2000/svg","svg");
		[["xmlns","http://www.w3.org/2000/svg"],["viewBox","0 -40 715 200"],["height","140px"],["width","90%"]]
			.forEach(attr => node.setAttribute(attr[0],attr[1]));
		node.innerHTML='<path d="M74.3 2L47.5 142H26.7L0 2h21l15.6 95.9.5 12c-.1-2.7.1-6.7.5-12L53.4 2h20.9zm69.6 139h-58V1h58v19h-37v41h32v18h-32v44h37v18zm86.5 0h-21.9l-23.6-64.5V64h21V19h-26v122h-21V1h55.4c8.4 0 12.6 4.3 12.6 12.9v50.9c0 5.9-2 9.7-6 11.5-2.1.9-6.7 1.3-13.6 1.3l23.1 63.4zm97.5 0h-20V72.4c-.1-3.6.3-8.7 1.1-15.2L291 129h-10.7l-18.2-71.8 1.8 15.2V141h-21V1h19.9l22.1 77.4c.2.8.4 3 .5 6.4 0-1.5.2-3.6.5-6.4L308.1 1H328v140zm38 0h-21V1h21v140zm72 0h-55V1h21v122h34v18zm68 0h-55V1h21v122h34v18zm34 0h-21V1h21v140zm88-12.8c0 8.5-4.3 12.8-12.8 12.8h-45.7c-8.3 0-12.5-4.3-12.5-12.8V13.9c0-8.6 4.2-12.9 12.5-12.9h45.7c8.5 0 12.8 4.3 12.8 12.9v114.3zm-21-5.2V19h-29v104h29zm108 18h-18.4l-32.9-88.1c.9 4.3 1.3 7.7 1.3 10.1v78h-20V1h18.4l32.9 86.3c-.9-4.3-1.3-7.7-1.3-10.1V1h20v140z" fill="var(--accent)"></path>';
		this.logo.replace(node);
		return this.saveConfig();
	}
}

let config = window.localStorage.getItem("meta_config");
if (config) config = JSON.parse(config);
else config = MetaTheme.defaultConfig;

const theme = new MetaTheme(config);
theme.runDOMManipulatior();
document.theme = theme;
}); // DOMContentLoaded

// Then at the end; black magic to make `theme` global variable available
window.onload = e => e.currentTarget.theme = document.theme
