const { Client, MessageButton, MessageActionRow, MessageSelectMenu ,TextInputComponent,Modal} = require('discord.js');
const config = require('./config.json');
const { Database } = require("st.db")
const temp_channels_db = new Database("./temp_channels.json");
const client = new Client({
    intents: 32767
});
client.on("ready", async () => {
    console.log("Bot is online!");
});

client.on("messageCreate", async message => {
    if (message.author.bot || !message.guild) return;
    if (message.content.startsWith(config.prefix + "send")) {
        if (!message.member.permissions.has("ADMINISTRATOR")) return message.reply(":x: ليس لديك إذن لاستخدام هذا الأمر!");
        let args = message.content.split(" ");
        let embeds = [{
            author: { name: "اعدادات الرومات المؤقتة", icon_url: message.guild.iconURL() },
            description: `قم بالضغط على الزر للتحكم بالروم الخاص بك:`,
            image: {
                url: message.attachments.first()?.url
            },
            color: 0x2F3136
        }]
        let MessageSelectMenuOptions = []
        config.voiceLimits.forEach(num => {
            MessageSelectMenuOptions.push({ label: `${num == 0 ? "No Limit" : num}`, value: `${num}` })
        })
        let row1 = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId(`temp_public_${Date.now()}`)
                    .setStyle('SECONDARY')
                    .setEmoji(config.emojis.public)
                    .setLabel("عام"),
                new MessageButton()
                    .setCustomId(`temp_private_${Date.now()}`)
                    .setStyle('SECONDARY')
                    .setEmoji(config.emojis.private)
                    .setLabel("خاص"),
                new MessageButton()
                    .setCustomId(`temp_unmute_${Date.now()}`)
                    .setStyle('SECONDARY')
                    .setEmoji(config.emojis.unmute)
                    .setLabel("فك كتم الصوت"),
                new MessageButton()
                    .setCustomId(`temp_mute_${Date.now()}`)
                    .setStyle('SECONDARY')
                    .setEmoji(config.emojis.mute)
                    .setLabel("كتم الصوت"),
                new MessageButton()
                    .setCustomId(`temp_rename_${Date.now()}`)
                    .setStyle('SECONDARY')
                    .setEmoji(config.emojis.rename)
                    .setLabel("تغير الاسم"),
            );
        let row2 = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('temp_limit_' + Date.now())
                    .setPlaceholder('عدد الاعضاء الذين يمكنهم الدخول')
                    .setMaxValues(1)
                    .setMinValues(1)
                    .addOptions(MessageSelectMenuOptions),
            );
        message.channel.send({ embeds, components: [row1, row2] }).then(() => {
            message.delete().catch(() => { })
        })
    }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
    if (newState.channelId !== null && newState.channelId == config.channelVoiceId) {
        newState.guild.channels.create(newState.member.user.username, {
            permissionOverwrites: [{
                id: newState.member.id,
                allow: ['SEND_MESSAGES', 'VIEW_CHANNEL', 'MANAGE_CHANNELS'],
            }, {
                id: newState.guild.id,
                deny: ['SEND_MESSAGES'],
            }], parent: config.categoryId, type: 2, reason: 'Temp channel Bot by Shuruhatik#2443'
        }).then(async (channeltemp) => {
            await newState.setChannel(channeltemp, 'Temp channel Bot by Shuruhatik#2443');
            await temp_channels_db.set(channeltemp.id, newState.member.id);
        })
            .catch(console.error);
    }
    if (oldState.channelId !== null && temp_channels_db.has(oldState.channelId)) {
        if (oldState.channel.members.filter(x => !x.user.bot).size == 0) {
            let channel = oldState.guild.channels.cache.get(oldState.channelId);
            await channel.delete();
            await temp_channels_db.delete(oldState.channelId);
        }
    }
})

client.on("interactionCreate", async interaction => {
    if (interaction.isSelectMenu()) {
        if (interaction.customId.startsWith("temp_limit")) {
            if (interaction.member.voice.channelId == null || interaction.member.voice.channelId !== null && !temp_channels_db.has(interaction.member.voice.channelId)) return await interaction.reply({ content: "انت لا تمتلك روم مؤقت :x:", ephemeral: true })
            if (!interaction.member.voice.channel.permissionsFor(interaction.member).has("MANAGE_CHANNELS")) return await interaction.reply({ content: "انت لا تمتلك صلاحية للتحكم بالروم المؤقت :x:", ephemeral: true })
            await interaction.deferReply({ ephemeral: true })
            await interaction.member.voice.channel.setUserLimit(+interaction.values[0]).catch(console.error)
            await interaction.editReply({
                embeds: [{
                    title: "تم تنفيذ طلبك بنجاح ✅",
                    fields: [{ name: "الروم المحدد", value: `<#${interaction.member.voice.channelId}>` }],
                    color: 0x2F3136,
                    timestamp: new Date()
                }], ephemeral: true
            })

        }
    }
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("temp_rename")) {
            await interaction.reply({ ephemeral: true,embeds:[{
                title:"برجاء الانتظار.",
                description:`يتم تغير اسم الروم الخاص بك.`,
                fields:[{name:"ملاحظة:",value:"تحذير ، إذا كررت هذا أكثر من مرتين ، فستتلقى حد الاقصي المستحق لك من ديسكورد ، لذلك عليك الانتظار لمدة 10 دقائق."}],
                color:0x2F3136
            }] })
            let guild = await client.guilds.fetch(interaction.guildId)
            let channel = await guild.channels.cache.get(interaction.customId.split("_")[2]);
            await channel.edit({
                name: interaction.fields.getTextInputValue('new_name'),
            }).catch(console.error)
            await interaction.editReply({
                embeds: [{
                    title: "تم تنفيذ طلبك بنجاح ✅",
                    fields: [{ name: "الروم المحدد", value: `<#${interaction.member.voice.channelId}>` }],
                    color: 0x2F3136,
                    timestamp: new Date()
                }], ephemeral: true
            })
        }
    }
    if (interaction.isButton()) {
        if (interaction.customId.startsWith("temp")) {
            if (interaction.member.voice.channelId == null || interaction.member.voice.channelId !== null && !temp_channels_db.has(interaction.member.voice.channelId)) return await interaction.reply({ content: "انت لا تمتلك روم مؤقت :x:", ephemeral: true })
            if (!interaction.member.voice.channel.permissionsFor(interaction.member).has("MANAGE_CHANNELS")) return await interaction.reply({ content: "انت لا تمتلك صلاحية للتحكم بالروم المؤقت :x:", ephemeral: true })
            if (interaction.customId.split("_")[1] == "rename") {
                const modal = new Modal()
                    .setCustomId('temp_rename_'+interaction.member.voice.channelId+'_'+Date.now())
                    .setTitle('إعادة تسمية الروم المؤقت')
                    .addComponents(
                        new MessageActionRow()
                        .addComponents(new TextInputComponent()
                        .setCustomId("new_name")
                        .setMaxLength(40)
                        .setMinLength(2)
                        .setLabel("الاسم الجديد")
                        .setPlaceholder("الاسم القديم : " + interaction.member.voice.channel.name)
                        .setStyle('SHORT'))
                    );
                await interaction.showModal(modal);
            } else {
                await interaction.deferReply({ ephemeral: true })
                if (interaction.customId.split("_")[1] == "private") {
                    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.id, {
                        VIEW_CHANNEL: false
                    }).catch(() => { });
                } else if (interaction.customId.split("_")[1] == "public") {
                    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.id, {
                        VIEW_CHANNEL: true
                    }).catch(() => { });
                } else if (interaction.customId.split("_")[1] == "unmute") {
                    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.id, {
                        SPEAK: true
                    }).catch(() => { });
                } else if (interaction.customId.split("_")[1] == "mute") {
                    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.id, {
                        SPEAK: false
                    }).catch(() => { });
                }
                await interaction.editReply({
                    embeds: [{
                        title: "تم تنفيذ طلبك بنجاح ✅",
                        fields: [{ name: "الروم المحدد", value: `<#${interaction.member.voice.channelId}>` }],
                        color: 0x2F3136,
                        timestamp: new Date()
                    }], ephemeral: true
                })
            }
        }
    }
})

client.login(config.token);
