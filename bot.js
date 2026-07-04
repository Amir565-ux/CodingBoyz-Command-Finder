require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const METHODS_FILE = path.join(__dirname, 'methods.json');

function loadMethods() {
    if (!fs.existsSync(METHODS_FILE)) return {};
    return JSON.parse(fs.readFileSync(METHODS_FILE, 'utf8'));
}

function saveMethods(data) {
    fs.writeFileSync(METHODS_FILE, JSON.stringify(data, null, 2));
}

const commands = [
    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a new method (Admin Only)')
        .addStringOption(opt => opt.setName('name').setDescription('Name of the method').setRequired(true))
        .addStringOption(opt => opt.setName('summary').setDescription('Full summary of the method').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('get')
        .setDescription('Get a method sent to your DMs')
        .addStringOption(opt => opt.setName('name').setDescription('Name of the method you want').setRequired(true)),

    new SlashCommandBuilder()
        .setName('cmdfinder')
        .setDescription('Get help and guide for CodingBoyz Command Finder')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Successfully registered commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member } = interaction;

    if (commandName === 'add') {
        if (!member.permissions.has('Administrator')) {
            return interaction.reply({ content: "❌ Only Administrators can add methods.", ephemeral: true });
        }
        const name = options.getString('name');
        const summary = options.getString('summary');
        const methods = loadMethods();
        
        methods[name.toLowerCase()] = summary;
        saveMethods(methods);
        await interaction.reply({ content: `✅ Method **"${name}"** has been added successfully!`, ephemeral: true });
    }

    if (commandName === 'get') {
        const name = options.getString('name').toLowerCase();
        const methods = loadMethods();

        if (!methods[name]) {
            return interaction.reply({ content: `❌ Method **"${name}"** not found. Ask an admin to add it.`, ephemeral: true });
        }
        try {
            await user.send(`**Method: ${name}**\n\n${methods[name]}`);
            await interaction.reply({ content: "✅ Check your DMs for the method!", ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: "❌ I cannot send you DMs. Please enable DMs from server members.", ephemeral: true });
        }
    }

    if (commandName === 'cmdfinder') {
        const helpEmbed = {
            color: 0x0099ff,
            title: '📖 CodingBoyz Command Finder Guide',
            description: 'Welcome to CodingBoyz Command Finder! Here is how to use me:',
            fields: [
                { name: '/get method [name]', value: 'Searches for a method and sends it to your DMs.' },
                { name: '/add method [name] [summary]', value: '(Admin Only) Adds a new method to my database.' },
                { name: 'Dashboard', value: 'Admins can manage the bot and add methods via the Web Dashboard.' }
            ],
            footer: { text: 'Made by CodingBoyz' }
        };
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
