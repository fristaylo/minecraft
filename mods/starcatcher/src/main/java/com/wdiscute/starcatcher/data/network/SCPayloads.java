package com.wdiscute.starcatcher.data.network;

import com.wdiscute.starcatcher.data.network.tournament.CBActiveTournamentUpdatePayload;
import com.wdiscute.starcatcher.data.network.tournament.CBClearTournamentPayload;
import com.wdiscute.starcatcher.data.network.tournament.CBFinishedTournamentsListPayload;
import com.wdiscute.starcatcher.data.network.tournament.SBStandTournamentNameChangePayload;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

public class SCPayloads
{
    public static void register()
    {
        PayloadTypeRegistry.playS2C().register(CBFishingStartedPayload.TYPE, CBFishingStartedPayload.STREAM_CODEC);
        PayloadTypeRegistry.playC2S().register(SBFishingCompletedPayload.TYPE, SBFishingCompletedPayload.STREAM_CODEC);
        PayloadTypeRegistry.playS2C().register(CBFishCaughtNotifs.TYPE, CBFishCaughtNotifs.STREAM_CODEC);
        PayloadTypeRegistry.playC2S().register(SBFPsSeenPayload.TYPE, SBFPsSeenPayload.STREAM_CODEC);
        PayloadTypeRegistry.playC2S().register(SBStandTournamentNameChangePayload.TYPE, SBStandTournamentNameChangePayload.STREAM_CODEC);
        PayloadTypeRegistry.playS2C().register(CBActiveTournamentUpdatePayload.TYPE, CBActiveTournamentUpdatePayload.STREAM_CODEC);
        PayloadTypeRegistry.playS2C().register(CBClearTournamentPayload.TYPE, CBClearTournamentPayload.STREAM_CODEC);
        PayloadTypeRegistry.playC2S().register(SignGuidePayload.TYPE, SignGuidePayload.STREAM_CODEC);
        PayloadTypeRegistry.playS2C().register(CBFinishedTournamentsListPayload.TYPE, CBFinishedTournamentsListPayload.STREAM_CODEC);
        PayloadTypeRegistry.playC2S().register(SBTrackFishPayload.TYPE, SBTrackFishPayload.STREAM_CODEC);
        PayloadTypeRegistry.playC2S().register(SBSetEditableMessagePayload.TYPE, SBSetEditableMessagePayload.STREAM_CODEC);
        PayloadTypeRegistry.playS2C().register(CBOpenEditableMessagePayload.TYPE, CBOpenEditableMessagePayload.STREAM_CODEC);
        PayloadTypeRegistry.playS2C().register(CBOpenMessagePayload.TYPE, CBOpenMessagePayload.STREAM_CODEC);
        PayloadTypeRegistry.playS2C().register(CBDataMapsPayload.TYPE, CBDataMapsPayload.STREAM_CODEC);

        ServerPlayNetworking.registerGlobalReceiver(SBFishingCompletedPayload.TYPE, SBFishingCompletedPayload::handle);
        ServerPlayNetworking.registerGlobalReceiver(SBFPsSeenPayload.TYPE, SBFPsSeenPayload::handle);
        ServerPlayNetworking.registerGlobalReceiver(SBStandTournamentNameChangePayload.TYPE, SBStandTournamentNameChangePayload::handle);
        ServerPlayNetworking.registerGlobalReceiver(SignGuidePayload.TYPE, SignGuidePayload::handle);
        ServerPlayNetworking.registerGlobalReceiver(SBTrackFishPayload.TYPE, SBTrackFishPayload::handle);
        ServerPlayNetworking.registerGlobalReceiver(SBSetEditableMessagePayload.TYPE, SBSetEditableMessagePayload::handle);
    }

    @Environment(EnvType.CLIENT)
    public static void registerClient()
    {
        ClientPlayNetworking.registerGlobalReceiver(CBFishingStartedPayload.TYPE, CBFishingStartedPayload::handle);
        ClientPlayNetworking.registerGlobalReceiver(CBFishCaughtNotifs.TYPE, CBFishCaughtNotifs::handle);
        ClientPlayNetworking.registerGlobalReceiver(CBActiveTournamentUpdatePayload.TYPE, CBActiveTournamentUpdatePayload::handle);
        ClientPlayNetworking.registerGlobalReceiver(CBClearTournamentPayload.TYPE, CBClearTournamentPayload::handle);
        ClientPlayNetworking.registerGlobalReceiver(CBFinishedTournamentsListPayload.TYPE, CBFinishedTournamentsListPayload::handle);
        ClientPlayNetworking.registerGlobalReceiver(CBOpenEditableMessagePayload.TYPE, CBOpenEditableMessagePayload::handle);
        ClientPlayNetworking.registerGlobalReceiver(CBOpenMessagePayload.TYPE, CBOpenMessagePayload::handle);
        ClientPlayNetworking.registerGlobalReceiver(CBDataMapsPayload.TYPE, CBDataMapsPayload::handle);
    }
}
