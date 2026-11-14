package com.wdiscute.starcatcher.lib.multiblock.block;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.lib.multiblock.blockentities.IMultiBlockEntity;
import com.wdiscute.starcatcher.lib.multiblock.components.BlockLike;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.CollisionGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.EntityBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.DirectionProperty;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.VoxelShape;

import javax.annotation.Nullable;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.wdiscute.starcatcher.lib.multiblock.block.AbstractMultiBlock.CENTER;

public interface IMultiBlock extends IMBStateSharer, EntityBlock {

    List<BlockPos> makeFullBlockShape(Level level, BlockPos center, BlockState state, @Nullable BlockEntity blockEntity, @Nullable Direction direction);

    default @Nullable DirectionProperty getDirectionProperty(){
        return null;
    }

    default @Nullable Direction getDirection(BlockState state){
        if (getDirectionProperty() != null){
            return state.getValue(getDirectionProperty());
        }
        return null;
    }

    default List<BlockPos> getFullBlockShapeNoCache(Level level, @Nullable BlockEntity blockEntity, BlockPos center, BlockState state){
        if (blockEntity == null){
            blockEntity = level.getBlockEntity(center);
        }

        List<BlockPos> list = makeFullBlockShape(level, center, state, blockEntity, getDirection(state));

        Set<BlockPos> set = new HashSet<>(list);
        if (set.size() < list.size()) {
            Starcatcher.LOGGER.error("Multiblock {} at {} has overlapping blocks in its shape, this is likely caused by the BlockPos being mutable. Map them to BlockPos::immutable",
                    state.toString(), center);
        }

        return list;
    }

    default List<BlockPos> getFullBlockShape(BlockGetter level, BlockPos pos, BlockState state){
        BlockPos center = getCenter(level, pos);
        BlockEntity blockEntity = level.getBlockEntity(center);
        Level betterLevel = level instanceof Level ? (Level) level : null;

        if (!(blockEntity instanceof IMultiBlockEntity mbEntity)){
            return getFullBlockShapeNoCache(betterLevel, blockEntity ,center, state);
        }

        if (mbEntity.getFullBlockShapeCache().isEmpty()){
            List<BlockPos> blockPosList = getFullBlockShapeNoCache(betterLevel, blockEntity, center, state);
            blockPosList.forEach(BlockPos::immutable);

            mbEntity.setFullBlockShapeCache(blockPosList);
            return blockPosList;
        }

        return mbEntity.getFullBlockShapeCache();
    }

    static List<BlockPos> getFullShape(BlockGetter level, BlockPos pos){
        BlockState state = level.getBlockState(pos);

        if (state.getBlock() instanceof IMultiBlock multiBlock){
            return multiBlock.getFullBlockShape(level, pos, state);
        }

        return List.of(pos);
    }

    default BlockState getStateForEachBlock(BlockState state, BlockPos pos, BlockPos centerOffset, Level level, @Nullable Direction direction){
        return state;
    }

    default void onPlaceHelper(BlockState state, Level level, BlockPos pos, BlockState oldState) {
        verifyValidBlockEntity(level, pos);
        boolean isPlaced = IMultiBlockEntity.isPlaced(level, pos);

        if (isPlaced) shareBlockStates(level, pos, state);

        if (isCenter(state)) {
            if (!isPlaced) place(level, pos, state);
        }
    }

    default void place(Level level, BlockPos centerPos, BlockState stateOriginal){
        prepareForPlace(getFullBlockShape(level, centerPos, stateOriginal), level, centerPos, stateOriginal).forEach(blockLike -> {
            int flags = 66;

            BlockState stateNew = blockLike.state;
            BlockPos posNew = blockLike.pos;

            if (!level.getBlockState(posNew).equals(stateNew)) {
                level.setBlock(posNew, stateNew, flags);
            }

            if(level.getBlockEntity(posNew) instanceof IMultiBlockEntity entity && !entity.getCenter().equals(centerPos)) {
                entity.setCenter(centerPos);
                entity.getBlockEntity().setChanged();
            }
        });
    }

    default List<BlockLike> prepareForPlace(List<BlockPos> shape, Level level, BlockPos centerPos, BlockState stateOriginal){
        List<BlockLike> list = new ArrayList<>();

        shape.forEach(posNew -> {
            posNew = posNew.immutable();

            BlockState stateNew = stateOriginal.setValue(AbstractMultiBlock.CENTER, centerPos.equals(posNew));
            stateNew = getStateForEachBlock(stateNew, posNew, posNew.subtract(centerPos), level, getDirection(stateOriginal));

            list.add(new BlockLike(posNew, stateNew));
        });

        return list;
    }

    default BlockState getStateForPlacementHelper(BlockPlaceContext context) {
        return getStateForPlacementHelper(context, context.getHorizontalDirection());
    }

    default BlockState getStateForPlacementHelper(BlockPlaceContext context, Direction direction) {
        LevelReader level = context.getLevel();
        BlockPos pos = context.getClickedPos();
        BlockState state = self().defaultBlockState().setValue(CENTER, true);

        if (getDirectionProperty() != null){
            state = state.setValue(getDirectionProperty(), direction);
        }

        return canPlace(level, pos, state, context.getPlayer(), true) ? state : null;
    }

    default boolean canPlace(LevelReader level, BlockPos center, BlockState state, @Nullable Entity player, boolean ignoreEntities) {
        return getFullBlockShape(level, center, state).stream().allMatch(blockPos ->
                canReplaceBlock(level, blockPos, level.getBlockState(blockPos))
                        && extraSurviveRequirements(level, blockPos, state, blockPos.subtract(center))
                        && (entityUnobstructed(level, blockPos, state, player) || ignoreEntities)
                        && blockPos.getY() < level.getMaxBuildHeight() && blockPos.getY() > level.getMinBuildHeight());
    }

    default boolean canReplaceBlock(LevelReader level, BlockPos blockPos, BlockState state) {
        return state.canBeReplaced();
    }

    default boolean entityUnobstructed(CollisionGetter level, BlockPos pos, BlockState state, @Nullable Entity player) {
        CollisionContext context = player == null ? CollisionContext.empty() : CollisionContext.of(player);

        return getFullBlockShape(level, pos, state).stream().allMatch(blockPos -> level.isUnobstructed(state, blockPos, context));
    }

    default void destroy(BlockPos center, LevelAccessor level, BlockState state, boolean dropBlock){
        if (level.isClientSide()) return;

        if (level.getBlockState(center).is(state.getBlock())) {
            level.destroyBlock(center, dropBlock);
        }

        getIsolatedBlocks(center, level, state).forEach(pos ->{
            BlockState blockState = level.getBlockState(pos);
            if (blockState.is(state.getBlock())) {
                level.destroyBlock(pos, dropBlock);
            }
        });
    }

    default List<BlockPos> getIsolatedBlocks(BlockPos center, LevelAccessor level, BlockState state) {
        Set<BlockPos> posSet = new HashSet<>(getFullBlockShape(level, center, state));

        List<BlockPos> isolated = new ArrayList<>();

        for (BlockPos pos : posSet) {
            boolean hasNeighbor =
                    posSet.contains(pos.above()) ||
                            posSet.contains(pos.below()) ||
                            posSet.contains(pos.north()) ||
                            posSet.contains(pos.south()) ||
                            posSet.contains(pos.east())  ||
                            posSet.contains(pos.west());

            if (!hasNeighbor) {
                isolated.add(pos);
            }
        }

        return isolated;
    }

    default boolean allBlocksPresent(LevelReader level, BlockPos pos, BlockState state){
        if (level.isClientSide()) return true;
        BlockPos center = getCenter(level, pos);

        boolean ret = getFullBlockShape(level, center, state).stream().allMatch(blockPos -> level.getBlockState(blockPos).is(self()));

        boolean isMultiblock = isMultiblock(level, pos);
        if (ret && level.getBlockEntity(pos) instanceof IMultiBlockEntity entity && !entity.isPlaced() && isMultiblock) {
            getFullBlockShape(level, center, state).forEach(blockPos -> IMultiBlockEntity.setPlaced(level, blockPos, true));
        }

        return ret;
    }

    default BlockState updateShapeHelper(BlockState state, Direction direction, BlockState neighborState, LevelAccessor level, BlockPos pos, BlockPos neighborPos){
        if (!(level.getBlockEntity(pos) instanceof IMultiBlockEntity entity)) return Blocks.AIR.defaultBlockState();

        boolean canSurvive = state.canSurvive(level, pos);

        if (!canSurvive){
            destroy(entity.getCenter(), level, state, true);
            return Blocks.AIR.defaultBlockState();
        }

        return state;
    }

    default boolean canSurviveHelper(BlockState state, LevelReader level, BlockPos pos){
        if (level.getBlockEntity(pos) instanceof IMultiBlockEntity entity){
            boolean extraSurvive = getFullBlockShape(level, pos, state).stream().allMatch(blockPos -> extraSurviveRequirements(level, blockPos, state, entity.getOffset()));
            return (allBlocksPresent(level, pos, state) || !entity.isPlaced()) && extraSurvive;
        } else {
            return canPlace(level, pos, state, null, false);
        }
    }

    default boolean extraSurviveRequirements(LevelReader level, BlockPos pos, BlockState state, BlockPos centerOffset){
        return true;
    }

    default void preventCreativeDrops(Player player, Level level, BlockPos pos){
        if (player.isCreative() && level.getBlockEntity(pos) instanceof IMultiBlockEntity entity) {
            destroy(entity.getCenter(), level, level.getBlockState(pos), false);
        }
    }

    static BlockPos getCenter(BlockGetter level, BlockPos pos){
        if (level.getBlockEntity(pos) instanceof IMultiBlockEntity entity){
            return entity.getCenter();
        }
        return pos;
    }

    static boolean isCenter(BlockState state){
        return state.getValue(CENTER);
    }

    static boolean isMultiblock(BlockState state){
        return state.getBlock() instanceof IMultiBlock;
    }

    static boolean isMultiblock(BlockGetter level, BlockPos pos){
        return isMultiblock(level.getBlockState(pos));
    }

    default VoxelShape voxelShapeHelper(BlockState state, BlockGetter level, BlockPos pos, VoxelShape shape){
        if (level.getBlockEntity(pos) instanceof IMultiBlockEntity entity) {
            return shape.move(-entity.getOffset().getX(), -entity.getOffset().getY(), -entity.getOffset().getZ());
        }
        return shape;
    }

    private Block self(){
        if (this instanceof Block block){
            return block;
        } else {
            throw new RuntimeException(this.getClass().getSimpleName() + " is not implemented on a Block");
        }
    }

    static void verifyValidBlockEntity(Level level, BlockPos pos){
        BlockEntity blockEntity = level.getBlockEntity(pos);

        if (blockEntity != null){
            if (!(blockEntity instanceof IMultiBlockEntity)){
                throw new IllegalStateException(blockEntity.getClass().getSimpleName() + " does not implement IMultiBlockEntity!");
            }
        }
    }
}
