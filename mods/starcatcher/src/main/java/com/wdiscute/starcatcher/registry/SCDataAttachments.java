package com.wdiscute.starcatcher.registry;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.data.attachments.FishingBobAttachment;
import com.wdiscute.starcatcher.data.attachments.FishingGuideAttachment;
import com.wdiscute.starcatcher.messageinabottle.message.Message;
import com.wdiscute.starcatcher.modifiers.Modifier;
import net.fabricmc.fabric.api.attachment.v1.AttachmentRegistry;
import net.fabricmc.fabric.api.attachment.v1.AttachmentSyncPredicate;
import net.fabricmc.fabric.api.attachment.v1.AttachmentType;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.Entity;

import java.util.List;

public interface SCDataAttachments
{
    AttachmentType<FishingBobAttachment> FISHING_BOB = AttachmentRegistry.create(
            Starcatcher.rl("fishing_bob"), builder -> builder
                    .initializer(() -> new FishingBobAttachment(""))
                    .syncWith(FishingBobAttachment.STREAM_CODEC, AttachmentSyncPredicate.all())
    );

    AttachmentType<List<Message>> MESSAGES_CAUGHT = AttachmentRegistry.create(
            Starcatcher.rl("messages_caught"), builder -> builder
                    .initializer(() -> List.<Message>of())
                    .syncWith(Message.STREAM_CODEC.apply(ByteBufCodecs.list()), AttachmentSyncPredicate.targetOnly())
    );

    AttachmentType<ResourceLocation> TRACKED_FISH = AttachmentRegistry.create(
            Starcatcher.rl("tracked_fish"), builder -> builder
                    .initializer(() -> Starcatcher.MISSINGNO)
                    .persistent(ResourceLocation.CODEC)
                    .syncWith(ResourceLocation.STREAM_CODEC, AttachmentSyncPredicate.targetOnly())
    );

    AttachmentType<FishingGuideAttachment> FISHING_GUIDE = AttachmentRegistry.create(
            Starcatcher.rl("fishing_guide"), builder -> builder
                    .initializer(FishingGuideAttachment::createDefault)
                    .persistent(FishingGuideAttachment.CODEC)
                    .syncWith(FishingGuideAttachment.STREAM_CODEC, AttachmentSyncPredicate.targetOnly())
                    .copyOnDeath()
    );

    AttachmentType<ResourceLocation> TACKLE_SKIN = AttachmentRegistry.create(
            Starcatcher.rl("tackle_skin"), builder -> builder
                    .initializer(() -> Starcatcher.BASE)
                    .persistent(ResourceLocation.CODEC)
                    .syncWith(ResourceLocation.STREAM_CODEC, AttachmentSyncPredicate.all())
    );

    AttachmentType<List<Modifier>> MODIFIERS = AttachmentRegistry.create(
            Starcatcher.rl("modifiers"), builder -> builder
                    .initializer(() -> List.<Modifier>of())
                    .persistent(Modifier.CODEC.listOf())
                    .syncWith(ByteBufCodecs.fromCodec(Modifier.CODEC).apply(ByteBufCodecs.list()), AttachmentSyncPredicate.targetOnly())
    );


    // sets the value to default
    static <T> void remove(Entity holder, AttachmentType<T> attachmentType)
    {
        if(holder == null) return;
        holder.removeAttached(attachmentType);
    }

    static <T> void set(Entity holder, AttachmentType<T> attachmentType, T data)
    {
        if(holder == null) return;
        holder.setAttached(attachmentType, data);
    }

    static <T> T get(Entity holder, AttachmentType<T> attachmentType)
    {
        if(holder == null) throw new RuntimeException("Called Starcatcher DataAttachments Get() with a null entity");
        return holder.getAttachedOrCreate(attachmentType);
    }

    static void register()
    {
    }

}
