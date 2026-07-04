require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
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

// Define Slash Commands
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

// Register Commands on Startup
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

// When Bot Logs In
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // YOUR CHANNEL ID HERE
    const channelId = '1522230823489900571'; 
    
    // Send message to the channel when bot starts
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        channel.send("🟢 **CodingBoyz Command Finder is now online!** Type `/cmdfinder` to see how to use me.");
    } else {
        console.log("Could not find the channel. Ensure the bot has permission to see it.");
    }
});

// Handle Slash Commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member } = interaction;

    if (commandName === 'add') {
        // ADMIN ONLY CHECK
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

// ==========================================
// DASHBOARD API TO SEND TO CHANNEL
// ==========================================
const dashApp = express();
dashApp.use(express.json());

dashApp.post('/send-to-channel', async (req, res) => {
    // If no channel ID is provided in the request, use your default channel ID
    const channelId = req.body.channelId || '1522230823489900571';
    const { message } = req.body;

    if (!message) return res.status(400).send("Message is required");

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return res.status(404).send("Channel not found");
        await channel.send(message);
        res.send("✅ Message sent successfully to the channel!");
    } catch (error) {
        res.status(500).send("❌ Error sending message: " + error.message);
    }
});

// We run this API on port 3001 so it doesn't conflict with the EJS dashboard on port 3000
dashApp.listen(3001, () => console.log('Bot Channel API running on port 3001'));
