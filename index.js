require('dotenv').config();
const express = require('express');
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
    PermissionsBitField,
    MessageFlags 
} = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Miwa Hub Bot is alive and operational 24/7!');
});

app.listen(PORT, () => {
    console.log(`🌐 Keep-alive server is listening on port ${PORT}`);
});

const SPECIFIC_CHANNEL_ID = "1522803202075132025"; 
const VERIFY_ROLE_ID = "1522516985974624317";      
const STAFF_ROLE_ID = "1522516757607223396";       
const TICKET_CATEGORY_ID = "1523675506111811656";
const AUTO_REACT_CHANNEL_ID = "1525590338104725564";

// Auto-Forward Configuration IDs
const FOLLOW_CHANNEL_ID = "1470799017045921977";
const DESTINATION_CHANNEL_ID = "1525876599143268423";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Slash Commands Configuration
const commands = [
    new SlashCommandBuilder()
        .setName('setuprules')
        .setDescription('Spawns the MIWA HUB rules embed with a Verify button.')
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

    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Giveaway automated management suite')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Starts a giveaway inside the server.')
                .addStringOption(option => option.setName('prize').setDescription('What is the giveaway prize?').setRequired(true))
                .addIntegerOption(option => option.setName('duration').setDescription('Giveaway duration in minutes (Max: 525600)').setRequired(true).setMinValue(1).setMaxValue(525600))
                .addIntegerOption(option => option.setName('winners').setDescription('Number of possible winners').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reroll')
                .setDescription('Reroll an ended giveaway with an optional winner limit count')
                .addStringOption(option => option.setName('message_id').setDescription('Giveaway Message ID').setRequired(true))
                .addIntegerOption(option => option.setName('winners').setDescription('Override number of new winners to draw').setRequired(false).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel and delete an active giveaway setup')
                .addStringOption(option => option.setName('message_id').setDescription('Active Giveaway Message ID').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('forcewin')
                .setDescription('Instantly end a giveaway and declare a winner.')
                .addStringOption(option => option.setName('message_id').setDescription('Active Giveaway Message ID').setRequired(true))
                .addUserOption(option => option.setName('target').setDescription('User to instantly win (Leave blank to pick randomly)').setRequired(false)))
];

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

    setInterval(checkGiveaways, 60000);
});

const activeGiveaways = new Map();

async function endGiveaway(messageId, giveawayData, forcedWinnerUser = null) {
    if (giveawayData.ended) return;
    giveawayData.ended = true;

    try {
        const guild = await client.guilds.fetch(giveawayData.guildId).catch(() => null);
        if (!guild) return;

        const targetChannel = await guild.channels.fetch(giveawayData.channelId).catch(() => null);
        if (!targetChannel) return;

        const giveawayMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
        if (!giveawayMessage) return;

        const chosenWinners = [];

        if (forcedWinnerUser) {
            chosenWinners.push(`<@${forcedWinnerUser.id}>`);
        } else {
            const pool = Array.from(giveawayData.entrants);
            if (pool.length > 0) {
                const actualWinnerCount = Math.min(giveawayData.winnerCount, pool.length);
                while (chosenWinners.length < actualWinnerCount) {
                    const randomIndex = Math.floor(Math.random() * pool.length);
                    const winnerId = pool.splice(randomIndex, 1)[0];
                    chosenWinners.push(`<@${winnerId}>`);
                }
            }
        }

        const endEmbed = new EmbedBuilder()
            .setTitle('🎁 GIVEAWAY ENDED 🎁')
            .setDescription(`**Prize:** ${giveawayData.prize}\n**Hosted By:** <@${giveawayData.hostId}>\n\n**Winners:** ${chosenWinners.length > 0 ? chosenWinners.join(', ') : 'No one joined the giveaway.'}`)
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

        await giveawayMessage.edit({ content: '🎉 **Giveaway Ended!**', embeds: [endEmbed], components: [disabledRow] }).catch(() => {});

        if (chosenWinners.length > 0) {
            await giveawayMessage.reply(`🎉 Congratulations ${chosenWinners.join(', ')}! You won the **${giveawayData.prize}**!`).catch(() => {});
        } else {
            await giveawayMessage.reply('❌ The giveaway ended, but no entries were logged.').catch(() => {});
        }
    } catch (err) {
        console.error("Error processing giveaway termination handler:", err);
    }
}

async function checkGiveaways() {
    const nowElement = Math.floor(Date.now() / 1000);
    for (const [messageId, data] of activeGiveaways.entries()) {
        if (!data.ended && nowElement >= data.endTimestamp) {
            await endGiveaway(messageId, data);
        }
    }
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, member } = interaction;
        const isStaff = member.roles.cache.has(STAFF_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator);

        const staffCommands = ['ban', 'kick', 'setuprules', 'setuptickets', 'purge', 'giveaway'];
        if (staffCommands.includes(commandName) && !isStaff) {
            return interaction.reply({ content: '❌ You do not have permission to use this staff command.', flags: [MessageFlags.Ephemeral] });
        }

        if (commandName === 'setuprules') {
            const embed = new EmbedBuilder()
                .setTitle('👑 MIWA HUB RULES 👑')
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

            await interaction.reply({ content: 'Rules panel deployed successfully!', flags: [MessageFlags.Ephemeral] });
            await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (commandName === 'setuptickets') {
            const embed = new EmbedBuilder()
                .setTitle('🎟️ MIWA HUB PREMIUM SUPPORT 🎟️')
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

            await interaction.reply({ content: 'Ticket deployment panel active!', flags: [MessageFlags.Ephemeral] });
            await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (commandName === 'ban') {
            const target = options.getUser('target');
            const reason = options.getString('reason') || 'No reason provided';
            const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!targetMember) return interaction.reply({ content: 'User not found.', flags: [MessageFlags.Ephemeral] });
            if (!targetMember.bannable) return interaction.reply({ content: 'I cannot ban this user (Hierarchy error).', flags: [MessageFlags.Ephemeral] });

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

            if (!targetMember) return interaction.reply({ content: 'User not found.', flags: [MessageFlags.Ephemeral] });
            if (!targetMember.kickable) return interaction.reply({ content: 'I cannot kick this user (Hierarchy error).', flags: [MessageFlags.Ephemeral] });

            await targetMember.kick(`Moderator: ${interaction.user.tag} | Reason: ${reason}`);
            await interaction.reply({ content: `✅ Successfully kicked **${target.tag}** for: *${reason}*.` });
        }

        if (commandName === 'purge') {
            const amount = options.getInteger('amount');
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            try {
                const deleted = await interaction.channel.bulkDelete(amount, true);
                await interaction.editReply({ content: `🧹 Cleared \`${deleted.size}\` messages. (Messages older than 14 days cannot be bulk deleted due to Discord limits.)` });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: '❌ An error occurred while trying to purge messages in this channel.' });
            }
        }

        if (commandName === 'giveaway') {
            const subcommand = options.getSubcommand();

            if (subcommand === 'start') {
                const prize = options.getString('prize');
                const duration = options.getInteger('duration');
                const winnerCount = options.getInteger('winners');

                await interaction.reply({ content: '🎉 Creating giveaway event panel...', flags: [MessageFlags.Ephemeral] });

                const endTime = Math.floor((Date.now() + duration * 60 * 1000) / 1000);

                const giveawayEmbed = new EmbedBuilder()
                    .setTitle('🎁 MIWA HUB GIVEAWAY 🎁')
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

                const giveawayMessage = await interaction.channel.send({ 
                    content: `🎉 **Giveaway Alert!** <@&${VERIFY_ROLE_ID}>`, 
                    embeds: [giveawayEmbed], 
                    components: [joinRow] 
                });
                
                activeGiveaways.set(giveawayMessage.id, {
                    prize,
                    winnerCount,
                    entrants: new Set(),
                    ended: false,
                    endTimestamp: endTime,
                    hostId: interaction.user.id,
                    channelId: interaction.channel.id,
                    guildId: interaction.guild.id
                });
            }

            if (subcommand === 'reroll') {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
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

            if (subcommand === 'cancel') {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const messageId = options.getString('message_id');

                const giveawayData = activeGiveaways.get(messageId);
                if (!giveawayData) {
                    return interaction.editReply(`❌ Unable to locate an active giveaway linked with Message ID: \`${messageId}\``);
                }
                if (giveawayData.ended) {
                    return interaction.editReply('❌ This giveaway has already ended and cannot be canceled.');
                }

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
                        await targetMsg.edit({ content: '🛑 **Giveaway Canceled**', embeds: [cancelEmbed], components: [disabledRow] }).catch(() => {});
                    }
                }

                activeGiveaways.delete(messageId);
                return interaction.editReply(`🛑 Successfully canceled the giveaway setup! The instance has been removed from active registries.`);
            }

            if (subcommand === 'forcewin') {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const messageId = options.getString('message_id');
                const targetUser = options.getUser('target');

                const giveawayData = activeGiveaways.get(messageId);
                if (!giveawayData) {
                    return interaction.editReply(`❌ Unable to locate an active giveaway linked with Message ID: \`${messageId}\``);
                }
                if (giveawayData.ended) {
                    return interaction.editReply('❌ This giveaway has already ended!');
                }

                await endGiveaway(messageId, giveawayData, targetUser);

                const winnerMention = targetUser ? `${targetUser.tag}` : 'instant drawing pool';
                return interaction.editReply(`⚡ Successfully forced the giveaway to end instantly! Winner: **${winnerMention}**.`);
            }
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
            const role = interaction.guild.roles.cache.get(VERIFY_ROLE_ID);
            if (!role) return interaction.reply({ content: 'Verification role not found. Contact staff.', flags: [MessageFlags.Ephemeral] });

            if (interaction.member.roles.cache.has(VERIFY_ROLE_ID)) {
                return interaction.reply({ content: 'You are already verified!', flags: [MessageFlags.Ephemeral] });
            }

            await interaction.member.roles.add(role);
            await interaction.reply({ content: '✅ You have been successfully verified and granted access!', flags: [MessageFlags.Ephemeral] });
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
            if (!giveawayData) return interaction.reply({ content: '❌ Error: Giveaway configuration could not be loaded from memory.', flags: [MessageFlags.Ephemeral] });
            if (giveawayData.ended) return interaction.reply({ content: '❌ This giveaway event has already closed processing pipelines.', flags: [MessageFlags.Ephemeral] });

            if (giveawayData.entrants.has(interaction.user.id)) {
                giveawayData.entrants.delete(interaction.user.id);
                
                const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFooter({ text: `Entries: ${giveawayData.entrants.size}` });
                await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => {});

                return interaction.reply({ content: '🏃 You have left the giveaway entry pool.', flags: [MessageFlags.Ephemeral] });
            }

            giveawayData.entrants.add(interaction.user.id);
            
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: `Entries: ${giveawayData.entrants.size}` });
            await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => {});

            return interaction.reply({ content: '✅ Entry logged! You have joined the active pool structure.', flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'close_ticket_instantly') {
            const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return interaction.reply({ content: '❌ Only staff can close tickets.', flags: [MessageFlags.Ephemeral] });

            await interaction.reply({ content: '🔒 Closing ticket environment in 5 seconds...' });
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 5000);
        }

        if (interaction.customId === 'close_ticket_with_reason') {
            const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return interaction.reply({ content: '❌ Only staff can close tickets.', flags: [MessageFlags.Ephemeral] });

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

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'ticket_form_modal') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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

client.on('messageCreate', async message => {
    if (!message.guild) return;

    // --- FEATURE: Auto-Forward Text Channel ---
    if (message.channel.id === FOLLOW_CHANNEL_ID) {
        if (message.author.id === client.user.id) return;

        try {
            const destinationChannel = await client.channels.fetch(DESTINATION_CHANNEL_ID).catch(() => null);
            
            if (destinationChannel && destinationChannel.isTextBased()) {
                const payload = {};

                if (message.content) {
                    payload.content = message.content;
                }

                if (message.attachments.size > 0) {
                    payload.files = Array.from(message.attachments.values());
                }

                if (message.embeds.length > 0) {
                    payload.embeds = message.embeds.map(e => EmbedBuilder.from(e));
                }

                if (payload.content || payload.files || payload.embeds) {
                    await destinationChannel.send(payload);
                }
            }
        } catch (err) {
            console.error("Auto-Forward system pipe error encountered:", err);
        }
    }

    if (message.author.bot) return;

    if (message.channel.id === AUTO_REACT_CHANNEL_ID) {
        await message.react('⭐').catch(err => console.error("Error applying auto reaction:", err));
    }

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
