package com.wdiscute.starcatcher.lib.multiblock.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;
import net.minecraft.client.Camera;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.block.BlockRenderDispatcher;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderer;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.PlaceOnWaterBlockItem;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.EntityBlock;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.shapes.CollisionContext;
import com.wdiscute.starcatcher.lib.multiblock.block.IMultiBlock;
import com.wdiscute.starcatcher.lib.multiblock.blockentities.IMultiBlockEntity;
import com.wdiscute.starcatcher.lib.multiblock.block.IPreviewableMultiblock;
import com.wdiscute.starcatcher.lib.multiblock.components.BlockLike;
import com.wdiscute.starcatcher.lib.multiblock.components.PreviewMode;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.HashSet;
import java.util.Set;

public class MultiblockPreviewRenderer {
    public static void register() {
        WorldRenderEvents.AFTER_TRANSLUCENT.register(context -> renderMultiblockPreviews(context.tickCounter().getGameTimeDeltaPartialTick(true), Minecraft.getInstance(), context.world(), context.camera(), context.matrixStack()));
    }

    private static void renderMultiblockPreviews(float partialTick, Minecraft minecraft, Level level, Camera camera, PoseStack poseStack) {
        MultiBufferSource.BufferSource buffer = minecraft.renderBuffers().bufferSource();
        LocalPlayer player = minecraft.player;
        assert player != null;
        ItemStack stack = player.getMainHandItem();
        Item item = stack.getItem();

        double camX = camera.getPosition().x;
        double camY = camera.getPosition().y;
        double camZ = camera.getPosition().z;

        if (item instanceof BlockItem blockItem) {

            if (!(minecraft.hitResult instanceof BlockHitResult blockHitResult)) return;

            boolean placeOnWater = false;

            if (blockItem instanceof PlaceOnWaterBlockItem) {
                blockHitResult = Item.getPlayerPOVHitResult(level, player, ClipContext.Fluid.SOURCE_ONLY);
                placeOnWater = level.isWaterAt(blockHitResult.getBlockPos());
            }

            Direction hitDirection = blockHitResult.getDirection();
            Block block = blockItem.getBlock();
            BlockPos hitPos = blockHitResult.getBlockPos();
            BlockPos pos = hitPos.relative(hitDirection);

            if (!(block instanceof IPreviewableMultiblock)) return;

            BlockState state = block.getStateForPlacement(new BlockPlaceContext(player, InteractionHand.MAIN_HAND, stack, blockHitResult));
            boolean hasNullState = false;

            if (state == null){
                hasNullState = true;
                state = block.defaultBlockState();

                if (block instanceof IPreviewableMultiblock multiblock){
                    multiblock.getDefaultStateForPreviews(player.getDirection());
                }
            }

            @Nullable
            BlockEntity blockEntity = block instanceof EntityBlock entityBlock ? entityBlock.newBlockEntity(pos, state) : null;
            if (blockEntity != null) {
                blockEntity.setLevel(level);
            }

            PreviewMode previewMode = getPreviewMode(level, pos, state, player, hasNullState);

            boolean shouldShowPreview = level.getBlockState(pos).canBeReplaced()
                    && (!level.getBlockState(hitPos).isAir() || placeOnWater);

            if (level.getBlockState(hitPos).canBeReplaced() && !placeOnWater)
                pos = pos.relative(hitDirection.getOpposite());

            poseStack.pushPose();

            poseStack.translate(pos.getX() - camX, pos.getY() - camY, pos.getZ() - camZ);

            FakeClientLevel fakeLevel = FakeClientLevel.getOrThrow();
            Set<BlockLike> blockLikeSet = gatherBlockLikes(fakeLevel, level, blockEntity, pos, state, minecraft.player, stack);

            if (shouldShowPreview) {
                fakeLevel.blockLikeSet = blockLikeSet;

                MultiBufferSource.BufferSource tintedBuffer = new TintedBufferSource(buffer, previewMode);
                VertexConsumer vertexConsumer = tintedBuffer.getBuffer(RenderType.translucent());

                for (BlockLike blockLike : blockLikeSet) {
                    renderJsonModels(blockLike, pos, poseStack, vertexConsumer, minecraft, fakeLevel);
                }

                tintedBuffer.endLastBatch();

                for (BlockLike blockLike : blockLikeSet) {
                    renderBlockEntity(blockLike, pos, poseStack, partialTick,  tintedBuffer, minecraft, fakeLevel);
                }

            }

            poseStack.popPose();
        }
    }

    private static void renderBlockEntity(BlockLike blockLike, BlockPos originalPos, PoseStack poseStack, float partialTick, MultiBufferSource.BufferSource buffer, Minecraft minecraft, FakeClientLevel fakeClientLevel) {
        BlockState state = blockLike.state;
        BlockPos pos = blockLike.pos;

        if (state.getBlock() instanceof EntityBlock entityBlock) {

            BlockEntity entity = entityBlock.newBlockEntity(pos, state);
            if (entity == null) return;
            entity.setLevel(fakeClientLevel);

            if (entity instanceof IMultiBlockEntity multiBlockEntity) {
                multiBlockEntity.setCenter(originalPos);
            }

            BlockEntityRenderer<BlockEntity> entityRender = minecraft.getBlockEntityRenderDispatcher().getRenderer(entity);

            if (entityRender != null) {
                poseStack.pushPose();
                poseStack.translate(0.0001, 0.0001, 0.0001);

                BlockPos offset = blockLike.pos.subtract(originalPos).immutable();
                poseStack.translate(offset.getX(), offset.getY(), offset.getZ());

                entityRender.render(entity, partialTick, poseStack, buffer, 0xFFFFFF, OverlayTexture.NO_OVERLAY);

                poseStack.popPose();
            }
        }
    }

    private static @NotNull PreviewMode getPreviewMode(Level level, BlockPos pos, BlockState state, LocalPlayer player, boolean hasNullState) {
        if (hasNullState) return PreviewMode.INVALID;

        boolean multiBlockCanPlace = canPlace(level, pos, state, player);
        boolean entityUnobstructed = isEntityUnobstructed(level, state.getBlock(), pos, state, player);

        return multiBlockCanPlace ? (entityUnobstructed ? PreviewMode.PREVIEW : PreviewMode.ENTITY_BLOCKED) : PreviewMode.INVALID;
    }

    private static boolean isEntityUnobstructed(Level level, Block block, BlockPos pos, BlockState state, LocalPlayer player) {
        if (block instanceof IPreviewableMultiblock multiBlock) {
            return multiBlock.entityUnobstructed(level, pos, state, player);
        }
        return level.isUnobstructed(state, pos, CollisionContext.of(player));
    }

    private static boolean canPlace(Level level, BlockPos pos, BlockState state, LocalPlayer player) {
        if (state.getBlock() instanceof IPreviewableMultiblock multiBlock) {
            return multiBlock.canPlace(level, pos, state, player, true);
        }

        return state.canSurvive(level, pos);
    }

    private static void renderJsonModels(BlockLike blockLike, BlockPos originalPos, PoseStack poseStack, VertexConsumer vertexConsumer, Minecraft minecraft, FakeClientLevel fakeLevel) {

        if (!blockLike.state.getRenderShape().equals(RenderShape.MODEL)) return;

        BlockRenderDispatcher blockRenderer = minecraft.getBlockRenderer();

        poseStack.pushPose();
        poseStack.translate(0.0001, 0.0001, 0.0001);

        BlockPos offset = blockLike.pos.subtract(originalPos).immutable();
        poseStack.translate(offset.getX(), offset.getY(), offset.getZ());

        blockRenderer.renderBatched(blockLike.state, blockLike.pos, fakeLevel, poseStack, vertexConsumer, true, minecraft.level.getRandom());

        poseStack.popPose();
    }

    public static Set<BlockLike> gatherBlockLikes(FakeClientLevel fakeLevel, Level level, BlockEntity mbEntity, BlockPos pos, BlockState state, LivingEntity placer, ItemStack stack) {
        Set<BlockLike> blockLikeSet = new HashSet<>();

        if (state.getBlock() instanceof IMultiBlock multiBlock) {
            blockLikeSet.addAll(multiBlock.prepareForPlace(multiBlock.getFullBlockShapeNoCache(level, mbEntity, pos, state), level, pos, state));
        } else {
            blockLikeSet.add(new BlockLike(pos, state));
        }

        state.getBlock().setPlacedBy(fakeLevel, pos, state, placer, stack);

        blockLikeSet.addAll(fakeLevel.blockLikeSet);

        return blockLikeSet;
    }
}
