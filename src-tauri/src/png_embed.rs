//! Splice a snippr scene chunk (`snIp`) into a finished PNG byte stream.
//!
//! The chunk is ancillary (lowercase first letter) and safe-to-copy (lowercase
//! fourth letter), so generic decoders ignore it and the visible image is
//! unchanged. The chunk *data* is opaque here — the frontend owns the scene
//! schema; Rust only does the byte mechanics (length + type + data + CRC) and
//! inserts the chunk immediately before IEND. No re-encode, no pixel touch.

use crc32fast::Hasher;

const PNG_SIG: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const CHUNK_TYPE: [u8; 4] = *b"snIp";

/// Insert one `snIp` chunk carrying `chunk_data` just before the IEND chunk.
/// `flat_png` must be a complete, valid PNG (the WebView's `toDataURL` produced it).
pub fn inject_snip_chunk(flat_png: &[u8], chunk_data: &[u8]) -> Result<Vec<u8>, String> {
    if flat_png.len() < 8 || flat_png[..8] != PNG_SIG {
        return Err("not a PNG (bad signature)".into());
    }
    let iend_off = find_iend(flat_png).ok_or("IEND chunk not found")?;

    // Build the chunk: [len BE][type][data][crc BE]. CRC covers type + data only.
    let mut chunk = Vec::with_capacity(12 + chunk_data.len());
    chunk.extend_from_slice(&(chunk_data.len() as u32).to_be_bytes());
    chunk.extend_from_slice(&CHUNK_TYPE);
    chunk.extend_from_slice(chunk_data);
    let mut h = Hasher::new();
    h.update(&CHUNK_TYPE);
    h.update(chunk_data);
    chunk.extend_from_slice(&h.finalize().to_be_bytes());

    // Splice: [..IEND start] + chunk + [IEND..end]
    let mut out = Vec::with_capacity(flat_png.len() + chunk.len());
    out.extend_from_slice(&flat_png[..iend_off]);
    out.extend_from_slice(&chunk);
    out.extend_from_slice(&flat_png[iend_off..]);
    Ok(out)
}

/// Byte offset of the IEND chunk's length field (i.e. the start of the chunk).
fn find_iend(png: &[u8]) -> Option<usize> {
    let mut off = 8;
    while off + 8 <= png.len() {
        let len = u32::from_be_bytes(png[off..off + 4].try_into().ok()?) as usize;
        if &png[off + 4..off + 8] == b"IEND" {
            return Some(off);
        }
        off = off + 8 + len + 4; // length + type + data + crc
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Inject a chunk, then confirm (a) the visible image still decodes with an
    /// independent decoder (the `image` crate, not the WebView that made it —
    /// the CLAUDE.md "external decoder" rule) and (b) our chunk reads back intact.
    #[test]
    fn round_trips_chunk_before_iend() {
        let mut flat = Vec::new();
        {
            let img = image::RgbaImage::from_pixel(2, 2, image::Rgba([1, 2, 3, 255]));
            image::DynamicImage::ImageRgba8(img)
                .write_to(&mut std::io::Cursor::new(&mut flat), image::ImageFormat::Png)
                .unwrap();
        }
        let payload = b"SNPR-test-payload-bytes";
        let out = inject_snip_chunk(&flat, payload).unwrap();

        // The visible image still decodes.
        assert!(image::load_from_memory(&out).is_ok());
        // Our chunk is present with the right data.
        let found = find_chunk(&out, b"snIp").expect("snIp present");
        assert_eq!(found, payload);
        // The chunk sits immediately before IEND.
        assert!(find_iend(&out).unwrap() > find_iend(&flat).unwrap());
    }

    #[test]
    fn rejects_non_png() {
        assert!(inject_snip_chunk(b"not a png", b"x").is_err());
    }

    /// Mirrors `find_iend` but returns the data slice for any chunk type.
    fn find_chunk<'a>(png: &'a [u8], want: &[u8; 4]) -> Option<&'a [u8]> {
        let mut off = 8;
        while off + 8 <= png.len() {
            let len = u32::from_be_bytes(png[off..off + 4].try_into().ok()?) as usize;
            if &png[off + 4..off + 8] == want {
                return Some(&png[off + 8..off + 8 + len]);
            }
            off = off + 8 + len + 4;
        }
        None
    }
}
