"use strict";
// ===== QRコード生成（外部ライブラリなし・無料）=====
// 8ビットバイト（UTF-8）、誤り訂正レベルM、バージョン1〜10（約150バイトまで）に対応します。
(function () {
    // [全コード語数, 1ブロックあたりの誤り訂正語数, [ブロック数, データ語数] の組...]（レベルM）
    var VERSIONS = {
        1: [26, 10, [1, 16]], 2: [44, 16, [1, 28]], 3: [70, 26, [1, 44]], 4: [100, 18, [2, 32]], 5: [134, 24, [2, 43]],
        6: [172, 16, [4, 27]], 7: [196, 18, [4, 31]], 8: [242, 22, [2, 38], [2, 39]], 9: [292, 22, [3, 36], [2, 37]], 10: [346, 26, [4, 43], [1, 44]]
    };
    var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

    var EXP = new Array(512), LOG = new Array(256);
    (function () {
        var x = 1;
        for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
        for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
    })();
    function gmul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }

    function rsGenerator(degree) {
        var poly = [1];
        for (var i = 0; i < degree; i++) {
            var next = new Array(poly.length + 1).fill(0);
            for (var j = 0; j < poly.length; j++) {
                next[j] ^= poly[j];
                next[j + 1] ^= gmul(poly[j], EXP[i]);
            }
            poly = next;
        }
        return poly;
    }
    function rsRemainder(data, degree) {
        var gen = rsGenerator(degree), res = new Array(degree).fill(0);
        for (var i = 0; i < data.length; i++) {
            var factor = data[i] ^ res[0];
            res.shift(); res.push(0);
            for (var j = 0; j < degree; j++) res[j] ^= gmul(gen[j + 1], factor);
        }
        return res;
    }

    function utf8(text) { return Array.prototype.slice.call(new TextEncoder().encode(text)); }

    function dataCapacityBytes(version) {
        var info = VERSIONS[version], total = 0;
        for (var i = 2; i < info.length; i++) total += info[i][0] * info[i][1];
        return total;
    }

    function chooseVersion(length) {
        for (var v = 1; v <= 10; v++) {
            var countBits = v < 10 ? 8 : 16;
            if (4 + countBits + length * 8 <= dataCapacityBytes(v) * 8) return v;
        }
        throw new Error("QRコードにするには文字数が多すぎます。");
    }

    function buildCodewords(bytes, version) {
        var info = VERSIONS[version], capacity = dataCapacityBytes(version), bits = [];
        function put(value, count) { for (var i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); }
        put(4, 4); put(bytes.length, version < 10 ? 8 : 16);
        bytes.forEach(function (b) { put(b, 8); });
        put(0, Math.min(4, capacity * 8 - bits.length));
        while (bits.length % 8) bits.push(0);
        var data = [];
        for (var i = 0; i < bits.length; i += 8) { var v = 0; for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k]; data.push(v); }
        for (var pad = 0xEC; data.length < capacity; pad ^= 0xEC ^ 0x11) data.push(pad);

        var eccLen = info[1], blocks = [], pos = 0;
        for (var g = 2; g < info.length; g++) {
            for (var b = 0; b < info[g][0]; b++) {
                var d = data.slice(pos, pos + info[g][1]); pos += info[g][1];
                blocks.push({ data: d, ecc: rsRemainder(d, eccLen) });
            }
        }
        var out = [], maxLen = Math.max.apply(null, blocks.map(function (x) { return x.data.length; }));
        for (var c = 0; c < maxLen; c++) blocks.forEach(function (blk) { if (c < blk.data.length) out.push(blk.data[c]); });
        for (var e = 0; e < eccLen; e++) blocks.forEach(function (blk) { out.push(blk.ecc[e]); });
        return out;
    }

    function makeMatrix(size) {
        var m = [], f = [];
        for (var i = 0; i < size; i++) { m.push(new Array(size).fill(false)); f.push(new Array(size).fill(false)); }
        return { m: m, f: f, size: size };
    }
    function setFn(q, r, c, dark) { if (r >= 0 && c >= 0 && r < q.size && c < q.size) { q.m[r][c] = dark; q.f[r][c] = true; } }

    function drawFinder(q, r0, c0) {
        for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
            var inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
            var dark = inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
            setFn(q, r0 + dr, c0 + dc, dark);
        }
    }
    function drawAlign(q, cr, cc) {
        for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
            setFn(q, cr + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
    }

    function formatBits(mask) {
        var data = (0 << 3) | mask; // レベルM = 00
        var rem = data;
        for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        return ((data << 10) | rem) ^ 0x5412;
    }
    function versionBits(version) {
        var rem = version;
        for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
        return (version << 12) | rem;
    }

    function drawFunction(q, version) {
        var size = q.size;
        for (var i = 8; i < size - 8; i++) { setFn(q, 6, i, i % 2 === 0); setFn(q, i, 6, i % 2 === 0); }
        drawFinder(q, 0, 0); drawFinder(q, 0, size - 7); drawFinder(q, size - 7, 0);
        var pos = ALIGN[version];
        pos.forEach(function (r, ri) { pos.forEach(function (c, ci) {
            var corner = (ri === 0 && ci === 0) || (ri === 0 && ci === pos.length - 1) || (ri === pos.length - 1 && ci === 0);
            if (!corner) drawAlign(q, r, c);
        }); });
        // 形式情報の予約領域（あとで上書き）
        for (var k = 0; k < 9; k++) { if (k !== 6) { setFn(q, 8, k, false); setFn(q, k, 8, false); } }
        for (var t = 0; t < 8; t++) { setFn(q, 8, size - 1 - t, false); setFn(q, size - 1 - t, 8, false); }
        setFn(q, size - 8, 8, true); // 固定の暗モジュール
        if (version >= 7) {
            var vb = versionBits(version);
            for (var n = 0; n < 18; n++) {
                var bit = ((vb >>> n) & 1) === 1, a = size - 11 + (n % 3), b = Math.floor(n / 3);
                setFn(q, a, b, bit); setFn(q, b, a, bit);
            }
        }
    }

    function drawFormat(q, mask) {
        var bits = formatBits(mask), size = q.size;
        function bit(i) { return ((bits >>> i) & 1) === 1; }
        for (var i = 0; i <= 5; i++) setFn(q, i, 8, bit(i));
        setFn(q, 7, 8, bit(6)); setFn(q, 8, 8, bit(7)); setFn(q, 8, 7, bit(8));
        for (var j = 9; j < 15; j++) setFn(q, 8, 14 - j, bit(j));
        for (var k = 0; k < 8; k++) setFn(q, 8, size - 1 - k, bit(k));
        for (var l = 8; l < 15; l++) setFn(q, size - 15 + l, 8, bit(l));
        setFn(q, size - 8, 8, true);
    }

    function placeData(q, codewords) {
        var size = q.size, bitIndex = 0, total = codewords.length * 8;
        for (var right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5;
            for (var vert = 0; vert < size; vert++) {
                for (var j = 0; j < 2; j++) {
                    var x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
                    if (!q.f[y][x] && bitIndex < total) {
                        q.m[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
                        bitIndex++;
                    }
                }
            }
        }
    }

    function applyMask(q, mask) {
        for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) {
            if (q.f[r][c]) continue;
            var invert;
            switch (mask) {
                case 0: invert = (r + c) % 2 === 0; break;
                case 1: invert = r % 2 === 0; break;
                case 2: invert = c % 3 === 0; break;
                case 3: invert = (r + c) % 3 === 0; break;
                case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
                case 5: invert = ((r * c) % 2) + ((r * c) % 3) === 0; break;
                case 6: invert = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
                default: invert = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
            }
            if (invert) q.m[r][c] = !q.m[r][c];
        }
    }

    function penalty(m) {
        var size = m.length, score = 0, r, c, k;
        function runs(line) {
            var s = 0, run = 1;
            for (var i = 1; i <= line.length; i++) {
                if (i < line.length && line[i] === line[i - 1]) run++;
                else { if (run >= 5) s += 3 + (run - 5); run = 1; }
            }
            return s;
        }
        for (r = 0; r < size; r++) score += runs(m[r]);
        for (c = 0; c < size; c++) { var col = []; for (r = 0; r < size; r++) col.push(m[r][c]); score += runs(col); }
        for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
            var v = m[r][c]; if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
        }
        var pat1 = [true, false, true, true, true, false, true, false, false, false, false];
        var pat2 = pat1.slice().reverse();
        function finderLike(get, n) {
            var s = 0;
            for (var i = 0; i + 11 <= n; i++) {
                var a = true, b = true;
                for (var t = 0; t < 11; t++) { var x = get(i + t); if (x !== pat1[t]) a = false; if (x !== pat2[t]) b = false; }
                if (a) s += 40; if (b) s += 40;
            }
            return s;
        }
        for (r = 0; r < size; r++) score += finderLike(function (i) { return m[r][i]; }, size);
        for (c = 0; c < size; c++) score += finderLike(function (i) { return m[i][c]; }, size);
        var dark = 0; for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) dark++;
        k = Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size));
        return score + k * 10;
    }

    function encode(text, forceMask) {
        var bytes = utf8(String(text)), version = chooseVersion(bytes.length), size = version * 4 + 17;
        var codewords = buildCodewords(bytes, version), best = null, bestScore = Infinity;
        for (var mask = 0; mask < 8; mask++) {
            if (forceMask !== undefined && mask !== forceMask) continue;
            var q = makeMatrix(size);
            drawFunction(q, version);
            placeData(q, codewords);
            applyMask(q, mask);
            drawFormat(q, mask);
            var s = penalty(q.m);
            if (s < bestScore) { bestScore = s; best = q.m; }
        }
        return { version: version, size: size, modules: best };
    }

    function draw(canvas, text, pixels) {
        var qr = encode(text), quiet = 4, cells = qr.size + quiet * 2, scale = Math.max(1, Math.floor(pixels / cells));
        canvas.width = canvas.height = cells * scale;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000";
        for (var r = 0; r < qr.size; r++) for (var c = 0; c < qr.size; c++) {
            if (qr.modules[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
        return qr;
    }

    window.AREQR = { encode: encode, draw: draw };
})();
