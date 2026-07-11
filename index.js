require('dotenv').config();
const express = require('express'); // Web framework to keep Render active
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,        
    TextInputBuilder,    
    TextInputStyle,      
    ChannelType,         
    PermissionsBitField  
} = require('discord.js');

// ==================== KEEP-ALIVE WEB SERVER ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Bahade Hub Bot is alive and operational 24/7!');
});

app.listen(PORT, () => {
    console.log(`🌐 Keep-alive server is listening on port ${PORT}`);
});
// ===============================================================

// ==================== BOT CONFIGURATION ====================
const SPECIFIC_CHANNEL_ID = "1522803202075132025"; 
const VERIFY_ROLE_ID = "1522516985974624317";     
const STAFF_ROLE_ID = "1522516757607223396";      
const TICKET_CATEGORY_ID = "1523675506111811656"; // 📁 Tickets will be created under this category
const AUTO_REACT_CHANNEL_ID = "1525590338104725564"; // ⭐ Star react channel
// ===========================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Define Slash Commands Structure
const commands = [
    new SlashCommandBuilder()
        .setName('setuprules')
        .setDescription('Spawns the BAHADE HUB rules embed with a Verify button.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('setuptickets') 
        .setDescription('Spawns the Premium Support ticket panel with an Open Ticket button.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server and purges their recent chat history.')
        .addUserOption(option => option.setName('target').setDescription('The user to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the ban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server.')
        .addUserOption(option => option.setName('target').setDescription('The user to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the kick'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk deletes a specified number of messages from the channel.')
        .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to clear (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // ==================== NEW/UPDATED COMPLETE GIVEAWAY COMMANDS STRUCTURE ====================
    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Giveaway automated management suite')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        // SUBCOMMAND: START
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Starts a giveaway inside the server.')
                .addStringOption(option => option.setName('prize').setDescription('What is the giveaway prize?').setRequired(true))
                .addIntegerOption(option => option.setName('duration').setDescription('Giveaway duration in minutes').setRequired(true).setMinValue(1))
                .addIntegerOption(option => option.setName('winners').setDescription('Number of possible winners').setRequired(true).setMinValue(1)))
        // SUBCOMMAND: REROLL (WITH WINNERS LIMIT)
        .addSubcommand(subcommand =>
            subcommand
                .setName('reroll')
                .setDescription('Reroll an ended giveaway with an optional winner limit count')
                .addStringOption(option => option.setName('message_id').setDescription('Giveaway Message ID').setRequired(true))
                .addIntegerOption(option => option.setName('winners').setDescription('Override number of new winners to draw').setRequired(false).setMinValue(1)))
        // SUBCOMMAND: CANCEL
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel and delete an active giveaway setup')
                .addStringOption(option => option.setName('message_id').setDescription('Active Giveaway Message ID').setRequired(true)))
];

// Register slash commands globally when client connects
client.once('ready', async () => {
    console.log(`⚡ Logged in as ${client.user.tag}!`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands globally.');
    } catch (error) {
        console.error('Error registering application commands:', error);
    }
});

// Cache map to store active giveaway entrants dynamically in memory
const activeGiveaways = new Map();

// --- CORE INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
    
    // 1. CHAT SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
        const { commandName, options, member } = interaction;
        const isStaff = member.roles.cache.has(STAFF_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator);

        // Staff protection check for commands
        const staffCommands = ['ban', 'kick', 'setuprules', 'setuptickets', 'purge', 'giveaway'];
        if (staffCommands.includes(commandName) && !isStaff) {
            return interaction.reply({ content: '❌ You do not have permission to use this staff command.', ephemeral: true });
        }

        if (commandName === 'setuprules') {
            const embed = new EmbedBuilder()
                .setTitle('👑 BAHADE HUB RULES 👑')
                .setDescription('*Follow these rules or get banned. Simple as that.*')
                .setColor(0x00FF00)
                .addFields(
                    { name: '💬 1. CHAT & CONDUCT', value: '• **Be Respectful:** No toxicity, racism, or hate speech.\n• **No Spamming:** Keep chat clean and use bot commands in the proper channel.\n• **No Pinging:** Do not ping developers or staff.' },
                    { name: '💾 2. SCRIPTS & SAFETY', value: '• **No Links:** Do not share external scripts, executors, or malware links.\n• **No Leaking:** Do not crack, share, or bypass premium keys/scripts.' },
                    { name: '🛠️ 3. SUPPORT', value: '• **No DMs:** Do not DM staff for help. Open a ticket in the support channel.\n• **Show Proof:** Send screenshots/error logs when reporting a script bug.' },
                    { name: '⚠️ DISCLAIMER', value: 'Scripting carries ban risks. Always use an **ALT ACCOUNT**. We are not responsible for lost game accounts.' }
                )
                .setFooter({ text: 'Click the green button below to verify and get access!' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_button')
                    .setLabel('Verify Account')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.reply({ content: 'Rules panel deployed successfully!', ephemeral: true });
            await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (commandName === 'setuptickets') {
            const embed = new EmbedBuilder()
                .setTitle('🎟️ BAHADE HUB PREMIUM SUPPORT 🎟️')
                .setDescription('Need support regarding your custom Robux transaction, missing keys, or script activation?\n\nClick the button below to submit your support request form.')
                .setColor(0x5865F2)
                .setFooter({ text: 'A private support channel will be made for you.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket_btn')
                    .setLabel('Open Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎟️')
            );

            await interaction.reply({ content: 'Ticket deployment panel active!', ephemeral: true });
            await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (commandName === 'ban') {
            const target = options.getUser('target');
            const reason = options.getString('reason') || 'No reason provided';
            const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!targetMember) return interaction.reply({ content: 'User not found.', ephemeral: true });
            if (!targetMember.bannable) return interaction.reply({ content: 'I cannot ban this user (Hierarchy error).', ephemeral: true });

            await targetMember.ban({ 
                deleteMessageSeconds: 604800, 
                reason: `Moderator: ${interaction.user.tag} | Reason: ${reason}` 
            });
            
            await interaction.reply({ content: `✅ Successfully banned **${target.tag}** and purged their chat history from the last 7 days. Reason: *${reason}*.` });
        }

        if (commandName === 'kick') {
            const target = options.getUser('target');
            const reason = options.getString('reason') || 'No reason provided';
            const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!targetMember) return interaction.reply({ content: 'User not found.', ephemeral: true });
            if (!targetMember.kickable) return interaction.reply({ content: 'I cannot kick this user (Hierarchy error).', ephemeral: true });

            await targetMember.kick(`Moderator: ${interaction.user.tag} | Reason: ${reason}`);
            await interaction.reply({ content: `✅ Successfully kicked **${target.tag}** for: *${reason}*.` });
        }

        if (commandName === 'purge') {
            const amount = options.getInteger('amount');
            
            await interaction.deferReply({ ephemeral: true });
            try {
                const deleted = await interaction.channel.bulkDelete(amount, true);
                await interaction.editReply({ content: `🧹 Cleared \`${deleted.size}\` messages. (Messages older than 14 days cannot be bulk deleted due to Discord limits.)` });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: '❌ An error occurred while trying to purge messages in this channel.' });
            }
        }

        // ==================== REFACTORED WORKER: /GIVEAWAY [SUBCOMMANDS] ====================
        if (commandName === 'giveaway') {
            const subcommand = options.getSubcommand();

            // ------------------------------------------
            // METHOD: START
            // ------------------------------------------
            if (subcommand === 'start') {
                const prize = options.getString('prize');
                const duration = options.getInteger('duration');
                const winnerCount = options.getInteger('winners');

                await interaction.reply({ content: '🎉 Creating giveaway event panel...', ephemeral: true });

                const endTime = Math.floor((Date.now() + duration * 60 * 1000) / 1000);

                const giveawayEmbed = new EmbedBuilder()
                    .setTitle('🎁 BAHADE HUB GIVEAWAY 🎁')
                    .setDescription(`**Prize:** ${prize}\n\n**Winners:** ${winnerCount}\n**Ends:** <t:${endTime}:R> (<t:${endTime}:f>)\n**Hosted By:** ${interaction.user}`)
                    .setColor(0xFEE75C)
                    .setTimestamp()
                    .setFooter({ text: 'Entries: 0' });

                const joinRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('join_giveaway')
                        .setLabel('Join')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎉')
                );

                const giveawayMessage = await interaction.channel.send({ embeds: [giveawayEmbed], components: [joinRow] });
                
                // Clear and schedule core timing resolution
                const giveawayTimer = setTimeout(async () => {
                    const giveawayData = activeGiveaways.get(giveawayMessage.id);
                    if (!giveawayData || giveawayData.ended) return;

                    giveawayData.ended = true;
                    const pool = Array.from(giveawayData.entrants);
                    const chosenWinners = [];

                    if (pool.length > 0) {
                        const actualWinnerCount = Math.min(giveawayData.winnerCount, pool.length);
                        while (chosenWinners.length < actualWinnerCount) {
                            const randomIndex = Math.floor(Math.random() * pool.length);
                            const winnerId = pool.splice(randomIndex, 1)[0];
                            chosenWinners.push(`<@${winnerId}>`);
                        }
                    }

                    const endEmbed = new EmbedBuilder()
                        .setTitle('🎁 GIVEAWAY ENDED 🎁')
                        .setDescription(`**Prize:** ${giveawayData.prize}\n**Hosted By:** ${interaction.user}\n\n**Winners:** ${chosenWinners.length > 0 ? chosenWinners.join(', ') : 'No one joined the giveaway.'}`)
                        .setColor(0xED4245)
                        .setTimestamp();

                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('join_giveaway')
                            .setLabel('Giveaway Ended')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                            .setEmoji('🔒')
                    );

                    await giveawayMessage.edit({ embeds: [endEmbed], components: [disabledRow] }).catch(() => {});

                    if (chosenWinners.length > 0) {
                        await giveawayMessage.reply(`🎉 Congratulations ${chosenWinners.join(', ')}! You won **${giveawayData.prize}**!`).catch(() => {});
                    } else {
                        await giveawayMessage.reply('❌ The giveaway ended, but no entries were logged.').catch(() => {});
                    }

                    // Leave database profile logs untouched to allow future /reroll lookups
                }, duration * 60 * 1000);

                // Set up baseline data tree
                activeGiveaways.set(giveawayMessage.id, {
                    prize,
                    winnerCount,
                    entrants: new Set(),
                    ended: false,
                    timer: giveawayTimer,
                    hostId: interaction.user.id,
                    channelId: interaction.channel.id
                });
            }

            // ------------------------------------------
            // METHOD: REROLL
            // ------------------------------------------
            if (subcommand === 'reroll') {
                await interaction.deferReply({ ephemeral: true });
                const messageId = options.getString('message_id');
                const customWinnersCount = options.getInteger('winners');

                const giveawayData = activeGiveaways.get(messageId);
                if (!giveawayData) {
                    return interaction.editReply(`❌ Unable to find a matching giveaway context record for Message ID: \`${messageId}\``);
                }
                if (!giveawayData.ended) {
                    return interaction.editReply('❌ This giveaway has not ended yet! Use `/giveaway cancel` if you want to abort it.');
                }

                const pool = Array.from(giveawayData.entrants);
                const chosenWinners = [];
                const rolledTargetCount = customWinnersCount || giveawayData.winnerCount;

                if (pool.length > 0) {
                    const actualWinnerCount = Math.min(rolledTargetCount, pool.length);
                    while (chosenWinners.length < actualWinnerCount) {
                        const randomIndex = Math.floor(Math.random() * pool.length);
                        const winnerId = pool.splice(randomIndex, 1)[0];
                        chosenWinners.push(`<@${winnerId}>`);
                    }
                }

                const targetChannel = await interaction.guild.channels.fetch(giveawayData.channelId).catch(() => null);
                if (!targetChannel) return interaction.editReply('❌ Could not locate the original channel where the giveaway was hosted.');

                if (chosenWinners.length > 0) {
                    await targetChannel.send(`🎉 **Reroll Result:** Congratulations ${chosenWinners.join(', ')}! You won the reroll for **${giveawayData.prize}**!`);
                    return interaction.editReply(`✅ Successfully rerolled the giveaway! Drawn **${chosenWinners.length}** new winner(s).`);
                } else {
                    await targetChannel.send('❌ A reroll was attempted, but there are no valid entrants.');
                    return interaction.editReply('❌ No valid entrants were saved inside the database repository to pull winners from.');
                }
            }

            // ------------------------------------------
            // METHOD: CANCEL
            // ------------------------------------------
            if (subcommand === 'cancel') {
                await interaction.deferReply({ ephemeral: true });
                const messageId = options.getString('message_id');

                const giveawayData = activeGiveaways.get(messageId);
                if (!giveawayData) {
                    return interaction.editReply(`❌ Unable to locate an active giveaway linked with Message ID: \`${messageId}\``);
                }
                if (giveawayData.ended) {
                    return interaction.editReply('❌ This giveaway has already ended and cannot be canceled.');
                }

                // Unschedule global node timeouts loop instantly to prevent delayed payouts execution leaks
                clearTimeout(giveawayData.timer);

                const targetChannel = await interaction.guild.channels.fetch(giveawayData.channelId).catch(() => null);
                if (targetChannel) {
                    const targetMsg = await targetChannel.messages.fetch(messageId).catch(() => null);
                    if (targetMsg) {
                        const cancelEmbed = new EmbedBuilder()
                            .setTitle('🛑 GIVEAWAY CANCELED 🛑')
                            .setDescription(`The giveaway event for **${giveawayData.prize}** has been forcefully terminated by staff configuration panels.`)
                            .setColor(0x36393E)
                            .setTimestamp();

                        const disabledRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('join_giveaway')
                                .setLabel('Canceled')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                        );
                        await targetMsg.edit({ embeds: [cancelEmbed], components: [disabledRow] }).catch(() => {});
                    }
                }

                activeGiveaways.delete(messageId);
                return interaction.editReply(`🛑 Successfully canceled the giveaway setup! The instance has been removed from active registries.`);
            }
        }
    }

    // 2. BUTTON INTERACTIONS
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
            const role = interaction.guild.roles.cache.get(VERIFY_ROLE_ID);
            if (!role) return interaction.reply({ content: 'Verification role not found. Contact staff.', ephemeral: true });

            if (interaction.member.roles.cache.has(VERIFY_ROLE_ID)) {
                return interaction.reply({ content: 'You are already verified!', ephemeral: true });
            }

            await interaction.member.roles.add(role);
            await interaction.reply({ content: '✅ You have been successfully verified and granted access!', ephemeral: true });
        }

        if (interaction.customId === 'open_ticket_btn') {
            const modal = new ModalBuilder()
                .setCustomId('ticket_form_modal')
                .setTitle('Premium Support Form');

            const robloxUserInput = new TextInputBuilder()
                .setCustomId('form_roblox_user')
                .setLabel('Roblox Username:')
                .setPlaceholder('e.g., Shouta_Kun15')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const keyTypeInput = new TextInputBuilder()
                .setCustomId('form_key_type')
                .setLabel('Key:')
                .setPlaceholder('e.g., 30 Days Key, Lifetime Key')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('form_reason')
                .setLabel('Reason:')
                .setPlaceholder('Provide a description detailing why you are opening a ticket...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(robloxUserInput),
                new ActionRowBuilder().addComponents(keyTypeInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );

            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'join_giveaway') {
            const giveawayData = activeGiveaways.get(interaction.message.id);
            if (!giveawayData) return interaction.reply({ content: '❌ Error: Giveaway configuration could not be loaded from memory.', ephemeral: true });
            if (giveawayData.ended) return interaction.reply({ content: '❌ This giveaway event has already structural closed processing pipelines.', ephemeral: true });

            if (giveawayData.entrants.has(interaction.user.id)) {
                giveawayData.entrants.delete(interaction.user.id);
                
                const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFooter({ text: `Entries: ${giveawayData.entrants.size}` });
                await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => {});

                return interaction.reply({ content: '🏃 You have left the giveaway entry pool.', ephemeral: true });
            }

            giveawayData.entrants.add(interaction.user.id);
            
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: `Entries: ${giveawayData.entrants.size}` });
            await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => {});

            return interaction.reply({ content: '✅ Entry logged! You have joined the active pool structure.', ephemeral: true });
        }

        if (interaction.customId === 'close_ticket_instantly') {
            const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });

            await interaction.reply({ content: '🔒 Closing ticket environment in 5 seconds...' });
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 5000);
        }

        if (interaction.customId === 'close_ticket_with_reason') {
            const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });

            const modal = new ModalBuilder()
                .setCustomId('close_reason_modal')
                .setTitle('Close Ticket Reason');

            const reasonInput = new TextInputBuilder()
                .setCustomId('close_reason_input')
                .setLabel('Reason for closing:')
                .setPlaceholder('e.g., Issue resolved / Finished handling transaction.')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            return await interaction.showModal(modal);
        }
    }

    // 3. MODAL SUBMISSIONS
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'ticket_form_modal') {
            await interaction.deferReply({ ephemeral: true });

            const robloxUser = interaction.fields.getTextInputValue('form_roblox_user');
            const keyType = interaction.fields.getTextInputValue('form_key_type');
            const reason = interaction.fields.getTextInputValue('form_reason');

            const guild = interaction.guild;
            const channelName = `ticket-${interaction.user.username}`;

            try {
                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: TICKET_CATEGORY_ID, 
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        },
                        {
                            id: STAFF_ROLE_ID,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        }
                    ],
                });

                const ticketEmbed = new EmbedBuilder()
                    .setTitle('🎟️ Support Ticket Form Summary')
                    .setDescription(`Welcome ${interaction.user}. A support representative will review your profile shortly. Here are your transaction details:`)
                    .addFields(
                        { name: '👤 Roblox Username', value: `\`${robloxUser}\``, inline: true },
                        { name: '🔑 Key Status', value: `\`${keyType}\``, inline: true },
                        { name: '📝 Reason Provided', value: reason }
                    )
                    .setColor(0x2F3136)
                    .setTimestamp();

                const managementRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket_instantly')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('close_ticket_with_reason')
                        .setLabel('Close with Reason')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📝')
                );

                await ticketChannel.send({ 
                    content: `${interaction.user} | <@&${STAFF_ROLE_ID}>`, 
                    embeds: [ticketEmbed],
                    components: [managementRow] 
                });
                
                await interaction.editReply({ content: `✅ Form received successfully! Your ticket channel is ready here: ${ticketChannel}` });

            } catch (error) {
                console.error("Failed to generate custom private ticket thread:", error);
                await interaction.editReply({ content: `❌ Critical system error occurred while preparing your channel environment.` });
            }
        }

        if (interaction.customId === 'close_reason_modal') {
            const closeReason = interaction.fields.getTextInputValue('close_reason_input');
            await interaction.reply({ content: `🔒 Ticket closed by staff.\n**Reason:** ${closeReason}\n\n*Deleting channel in 5 seconds...*` });
            
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    }
});

// --- TEXT MESSAGE EVENT HANDLING ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // 1. AUTO REACT PIPELINE
    if (message.channel.id === AUTO_REACT_CHANNEL_ID) {
        await message.react('⭐').catch(err => console.error("Error applying auto reaction:", err));
    }

    // 2. HONEYPOT AUTOMATIC ONE-DAY BAN & PURGE HANDLER
    if (message.channel.id === SPECIFIC_CHANNEL_ID) {
        if (message.member.roles.cache.has(STAFF_ROLE_ID) || message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return; 
        }

        if (!message.member.bannable) {
            console.log(`Could not auto-ban ${message.author.tag} due to role hierarchy limits.`);
            return;
        }

        const targetUser = message.author;
        const targetMember = message.member;

        try {
            await targetMember.ban({ 
                deleteMessageSeconds: 604800, 
                reason: 'Auto-Ban: Chatting in honeypot restricted channel.' 
            });
            console.log(`Successfully auto-banned ${targetUser.tag}.`);

            const channelMessages = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
            if (channelMessages) {
                const userMessages = channelMessages.filter(msg => msg.author.id === targetUser.id);
                if (userMessages.size > 0) {
                    await message.channel.bulkDelete(userMessages).catch(() => 
                        console.log("Bulk delete skipped or met system limit age constraint (>14 days).")
                    );
                }
            }
        } catch (error) {
            console.error('Failed to properly complete auto-ban and purge pipeline:', error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);