const resolver = require("./resolver.js");
class Command {
	constructor(wiggle, name, ...extra) {
		let options = {};
		if(extra.length === 1) {
			this.process = extra[0];
		} else {
			this.process = extra[1];
			options = extra[0];
		}

		Object.entries(options).forEach(([key, value]) => this[key] = value);
		this.locals = {};
		this.name = name.toLowerCase();
		this.aliases = options.aliases || [];
		this.args = options.args || [];
		this.flags = options.flags || [];
		this.category = options.category || "default";
		this.caseSensitive = !!options.caseSensitive;
		this.cooldowns = new Map();
		this.guildOnly = !!options.guildOnly;

		if(options.cooldown) {
			if(Array.isArray(options.cooldown)) this.cooldown = { time: options.cooldown[0], uses: options.cooldown[1] };
			else if(typeof options.cooldown === "object") this.cooldown = options.cooldown;
			else this.cooldown = { time: options.cooldown, uses: 1 };
		} else {
			this.cooldown = {};
		}

		if(!this.args.length) {
			this.usage = this.flags.length ? "" : "[]";
		} else if(this.args.length) {
			this.usage = this.args.reduce((usage, arg) => {
				arg.label = arg.label || arg.type;
				usage += arg.optional ? `[${arg.label}] ` : `<${arg.label}> `;
				return usage;
			}, "").trim();
		}

		if(this.flags.length && this.args.length) this.usage += " ...";
		this.usage += this.flags.reduce((usage, flag) => {
			usage += ` --${flag.name}`;
			if(flag.short) usage += `|-${flag.short}`;
			if(flag.type && flag.default !== undefined) {
				usage += ` [${flag.type}=${flag.default}]`;
			} else {
				usage += ` [${flag.type}]`;
			}

			return usage;
		}, "").trim();
	}

	onCooldown(user) {
		return this.cooldowns.has(user.id);
	}

	addCooldown(user) {
		if(!this.cooldown) return;

		let cooldowns = this.cooldowns.get(user.id);
		if(cooldowns) this.cooldowns.set(user.id, cooldowns + 1);
		else this.cooldowns.set(user.id, 1);

		setTimeout(() => {
			cooldowns = this.cooldowns.get(user.id);
			if(cooldowns === 1) this.cooldowns.delete(user.id);
			else this.cooldowns.set(user.id, cooldowns - 1);
		}, this.cooldown.time);
	}

	async run(message, next, wiggle) {
		const { command } = this;
		if(command.sendTyping) await message.channel.sendTyping();

		const context = {
			args: message.args,
			author: message.author,
			category: command.category,
			channel: message.channel,
			client: wiggle.erisClient,
			content: message.content,
			command,
			flags: message.flags,
			guild: message.channel.guild,
			message,
			reply: (content, file) => {
				let params = [undefined, undefined];
				if(typeof content === "object" && content.embed) params[0] = { embed: content.embed };
				else if(typeof content === "object" && content.file) params[1] = content.file;
				else if(file) params[1] = file;
				else if(typeof content === "object" && Array.isArray(content)) params = content;
				else if(typeof content === "undefined" || content === null) return undefined;
				else params = [content];

				return message.channel.createMessage(...params);
			},
			resolver,
			t: message.t, // eslint-disable-line id-length
			wiggle
		};

		const result = await command.process(context, next);
		command.addCooldown(message.author);

		if(command.replyResult) context.reply(result);
	}
}

module.exports = Command;
