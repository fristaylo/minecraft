package com.wdiscute.starcatcher.event;

import com.wdiscute.starcatcher.SCConfig;
import com.wdiscute.starcatcher.SCTags;
import com.wdiscute.starcatcher.registry.*;
import com.wdiscute.starcatcher.data.network.tournament.CBFinishedTournamentsListPayload;
import com.wdiscute.starcatcher.data.TournamentSavedData;
import com.wdiscute.starcatcher.data.attachments.FishingGuideAttachment;
import com.wdiscute.starcatcher.tournament.TournamentHandler;
import com.wdiscute.starcatcher.lib.utils.Utils;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.transfer.v1.item.InventoryStorage;
import net.fabricmc.fabric.api.transfer.v1.item.ItemStorage;
import net.minecraft.core.BlockPos;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.FishingHook;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.FarmBlock;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.Vec3;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

public class SCEvents
{
    public static void register()
    {
        ServerLifecycleEvents.SERVER_STARTED.register(server ->
                TournamentHandler.setAll(TournamentSavedData.get(server.overworld()).getTournaments()));

        ServerLifecycleEvents.SERVER_STOPPING.register(server ->
                TournamentSavedData.get(server.overworld()).setTournaments(TournamentHandler.getAll()));

        ServerTickEvents.END_SERVER_TICK.register(TournamentHandler::tick);

        CommandRegistrationCallback.EVENT.register((dispatcher, context, environment) -> SCCommands.register(dispatcher, context));

        ItemStorage.SIDED.registerForBlockEntity(InventoryStorage::of, SCBlockEntities.TACKLE_BOX.get());

        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> onPlayerLoggedIn(handler.player));

        UseBlockCallback.EVENT.register((player, level, hand, hitResult) ->
        {
            dropWormsWhenBonemealing(player, level, hand, hitResult.getBlockPos());
            return InteractionResult.PASS;
        });

        PlayerBlockBreakEvents.AFTER.register((level, player, pos, state, blockEntity) ->
        {
            if (state.is(SCBlocks.AQUARIUM.get()))
                level.setBlockAndUpdate(pos, Blocks.AIR.defaultBlockState());
        });
    }

    public static void itemFished(FishingHook bobber)
    {
        if (!SCConfig.GIVE_ROD.get()) return;
        Player player = bobber.getPlayerOwner();
        if (SCDataAttachments.get(player, SCDataAttachments.FISHING_BOB).isEmpty())
        {
            if (!FishingGuideAttachment.getFishedRod(player))
            {
                FishingGuideAttachment.setFishedRod(player, true);

                double x = Math.clamp((player.position().x - bobber.position().x) / 25, -1, 1);
                double y = Math.clamp((player.position().y - bobber.position().y) / 20, -1, 1);
                double z = Math.clamp((player.position().z - bobber.position().z) / 25, -1, 1);
                Vec3 vec3 = new Vec3(x, 0.7 + y, z);

                ItemEntity rodFished = new ItemEntity(player.level(),
                        bobber.position().x, bobber.position().y + 1.2f, bobber.position().z,
                        SCItems.ROD.toStack());

                ItemEntity guideFished = new ItemEntity(player.level(),
                        bobber.position().x, bobber.position().y + 1.2f, bobber.position().z,
                        SCItems.GUIDE.toStack());

                rodFished.setDeltaMovement(vec3);
                guideFished.setDeltaMovement(vec3);

                bobber.level().addFreshEntity(guideFished);
                bobber.level().addFreshEntity(rodFished);

            }
        }
    }

    private static void onPlayerLoggedIn(ServerPlayer sp)
    {
        //send stats for guide book
        sp.getStats().sendStats(sp);

        //tournament
        var tournament = TournamentHandler.getTournamentForPlayer(sp);
        if (tournament != null)
            TournamentHandler.sendActiveTournamentUpdateToClient(sp, tournament);
        else
            TournamentHandler.clearTournamentToClient(sp);

        //send list of finished tournaments to client
        ServerPlayNetworking.send(sp, new CBFinishedTournamentsListPayload(TournamentHandler.getFinishedTournaments()));

        //guide
        if (SCConfig.GIVE_GUIDE.get() && !FishingGuideAttachment.getReceivedGuide(sp))
        {
            sp.addItem(new ItemStack(SCItems.GUIDE.get()));
            FishingGuideAttachment.setReceivedGuide(sp, true);
        }
    }

    private static void dropWormsWhenBonemealing(Player player, Level level, InteractionHand hand, BlockPos pos)
    {
        ItemStack stack = player.getItemInHand(hand);

        if (stack.is(SCTags.HAS_FARMLAND_INTERACTION) && level.getBlockState(pos).getBlock() instanceof FarmBlock)
        {
            if (!level.isClientSide && SCConfig.ENABLE_BONE_MEAL_ON_FARMLAND_FOR_WORMS.getAsBoolean())
            {
                ItemStack is = getWorm(level.getRandom());

                Vec3 vec3 = Vec3.atLowerCornerWithOffset(pos, 0.5F, 1.01, 0.5F).offsetRandom(level.random, 0.7F);
                ItemEntity itementity = new ItemEntity(level, vec3.x(), vec3.y(), vec3.z(), is);
                level.addFreshEntity(itementity);

                level.playSound(null, pos, SoundEvents.COMPOSTER_EMPTY, SoundSource.BLOCKS, 1.0F, 1.0F);

                if (player instanceof ServerPlayer serverPlayer)
                {
                    serverPlayer.swing(hand, true);
                    if (!serverPlayer.hasInfiniteMaterials())
                        stack.shrink(1);
                }
            }
        }
    }

    public static ItemStack getWorm(RandomSource random)
    {
        int totalWeight = SCDataEntries.FARMLAND_BONEMEAL_DROPS.get().stream()
                .mapToInt(Utils.Duo::second)
                .sum();

        if (totalWeight <= 0)
            return ItemStack.EMPTY;

        int value = random.nextInt(totalWeight);

        for (Utils.Duo<ItemStack, Integer> entry : SCDataEntries.FARMLAND_BONEMEAL_DROPS.get())
        {
            value -= entry.second();
            if (value < 0)
                return entry.first().copy();
        }

        return ItemStack.EMPTY;
    }
}
