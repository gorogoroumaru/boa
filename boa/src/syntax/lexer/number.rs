use super::{Cursor, Error, TokenKind, Tokenizer};
use crate::builtins::BigInt;
use crate::syntax::ast::{Position, Span};
use crate::syntax::lexer::{token::Numeric, Token};
use std::io::Read;
use std::str::FromStr;

/// Number literal lexing.
///
/// Assumes the digit is consumed by the cursor (stored in init).
///
/// More information:
///  - [ECMAScript reference][spec]
///  - [MDN documentation][mdn]
///
/// [spec]: https://tc39.es/ecma262/#sec-literals-numeric-literals
/// [mdn]:
#[derive(Debug, Clone, Copy)]
pub(super) struct NumberLiteral {
    init: char,
    strict_mode: bool,
}

impl NumberLiteral {
    /// Creates a new string literal lexer.
    pub(super) fn new(init: char, strict_mode: bool) -> Self {
        Self { init, strict_mode }
    }
}

/// This is a helper structure
///
/// This structure helps with identifying what numerical type it is and what base is it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NumericKind {
    Rational,
    Integer(u8),
    BigInt(u8),
}

impl NumericKind {
    /// Get the base of the number kind.
    fn base(self) -> u32 {
        match self {
            Self::Rational => 10,
            Self::Integer(base) => base as u32,
            Self::BigInt(base) => base as u32,
        }
    }

    /// Converts `self` to BigInt kind.
    fn to_bigint(self) -> Self {
        match self {
            Self::Rational => unreachable!("can not convert rational number to BigInt"),
            Self::Integer(base) => Self::BigInt(base),
            Self::BigInt(base) => Self::BigInt(base),
        }
    }
}

fn take_signed_integer<R>(
    buf: &mut String,
    cursor: &mut Cursor<R>,
    kind: &NumericKind,
) -> Result<(), Error>
where
    R: Read,
{
    // The next part must be SignedInteger.
    // This is optionally a '+' or '-' followed by 1 or more DecimalDigits.
    match cursor.next() {
        Some(Ok('+')) => {
            buf.push('+');
            if !cursor.next_is_pred(&|c: char| c.is_digit(kind.base()))? {
                // A digit must follow the + or - symbol.
                return Err(Error::syntax("No digit found after + symbol"));
            }
        }
        Some(Ok('-')) => {
            buf.push('-');
            if !cursor.next_is_pred(&|c: char| c.is_digit(kind.base()))? {
                // A digit must follow the + or - symbol.
                return Err(Error::syntax("No digit found after - symbol"));
            }
        }
        Some(Ok(c)) if c.is_digit(kind.base()) => {
            buf.push(c);
        }
        Some(Ok(c)) => {
            return Err(Error::syntax(format!(
                "When lexing exponential value found unexpected char: '{}'",
                c
            )));
        }
        Some(Err(e)) => {
            return Err(e.into());
        }
        None => {
            return Err(Error::syntax("No exponential value found"));
        }
    }

    // Consume the decimal digits.
    cursor.take_until_pred(buf, &|c: char| c.is_digit(kind.base()))?;

    Ok(())
}

impl<R> Tokenizer<R> for NumberLiteral {
    fn lex(&mut self, cursor: &mut Cursor<R>, start_pos: Position) -> Result<Token, Error>
    where
        R: Read,
    {
        let mut buf = self.init.to_string();

        // Default assume the number is a base 10 integer.
        let mut kind = NumericKind::Integer(10);

        let c = cursor.peek();

        if self.init == '0' {
            match c {
                None => {
                    // DecimalLiteral lexing.
                    // Indicates that the number is just a single 0.
                    return Ok(Token::new(
                        TokenKind::NumericLiteral(Numeric::Integer(0)),
                        Span::new(start_pos, cursor.pos()),
                    ));
                }
                Some(Err(e)) => {
                    // todo!();
                }
                Some(Ok('x')) | Some(Ok('X')) => {
                    // Remove the initial '0' from buffer.
                    cursor.next();
                    buf.pop();

                    // HexIntegerLiteral
                    kind = NumericKind::Integer(16);
                }
                Some(Ok('o')) | Some(Ok('O')) => {
                    // Remove the initial '0' from buffer.
                    cursor.next();
                    buf.pop();

                    // OctalIntegerLiteral
                    kind = NumericKind::Integer(8);
                }
                Some(Ok('b')) | Some(Ok('B')) => {
                    // Remove the initial '0' from buffer.
                    cursor.next();
                    buf.pop();

                    // BinaryIntegerLiteral
                    kind = NumericKind::Integer(2);
                }
                Some(Ok('n')) => {
                    cursor.next();

                    // DecimalBigIntegerLiteral '0n'
                    return Ok(Token::new(
                        TokenKind::NumericLiteral(Numeric::BigInt(0.into())),
                        Span::new(start_pos, cursor.pos()),
                    ));
                }
                Some(Ok(ch)) => {
                    if ch.is_digit(8) {
                        // LegacyOctalIntegerLiteral
                        if self.strict_mode {
                            // LegacyOctalIntegerLiteral is forbidden with strict mode true.
                            return Err(Error::strict(
                                "Implicit octal literals are not allowed in strict mode.",
                            ));
                        } else {
                            // Remove the initial '0' from buffer.
                            buf.pop();

                            let char = cursor.next().unwrap().unwrap();
                            buf.push(char);

                            kind = NumericKind::Integer(8);
                        }
                    } else if ch.is_digit(10) {
                        // Indicates a numerical digit comes after then 0 but it isn't an octal digit
                        // so therefore this must be a number with an unneeded leading 0. This is
                        // forbidden in strict mode.
                        if self.strict_mode {
                            return Err(Error::strict(
                                "Leading 0's are not allowed in strict mode.",
                            ));
                        } else {
                            let char = cursor.next().unwrap().unwrap();
                            buf.push(char);
                        }
                    } else {
                        // Indicates that the symbol is a non-number.
                    }
                }
            }
        }

        // Consume digits until a non-digit character is encountered or all the characters are consumed.
        cursor.take_until_pred(&mut buf, &|c: char| c.is_digit(kind.base()))?;

        // The non-digit character could be:
        // 'n' To indicate a BigIntLiteralSuffix.
        // '.' To indicate a decimal seperator.
        // 'e' | 'E' To indicate an ExponentPart.
        match cursor.peek() {
            Some(Ok('n')) => {
                // DecimalBigIntegerLiteral
                // Lexing finished.
                kind = kind.to_bigint();
            }
            Some(Ok('.')) => {
                kind = NumericKind::Rational;
                if kind.base() != 10 {
                    todo!("Non base 10 numbers with decimal seperators");
                }

                // Consume digits until a non-digit character is encountered or all the characters are consumed.
                cursor.take_until_pred(&mut buf, &|c: char| c.is_digit(kind.base()))?;

                // The non-digit character at this point must be an 'e' or 'E' to indicate an Exponent Part.
                // Another '.' or 'n' is not allowed.
                match cursor.peek() {
                    Some(Ok('n')) => {
                        return Err(Error::syntax(
                            "Found BigIntLiteralSuffix after non-integer number",
                        ));
                    }
                    Some(Ok('.')) => {
                        return Err(Error::syntax("Found second '.' within decimal number"));
                    }
                    Some(Ok('e')) | Some(Ok('E')) => {
                        // Consume the ExponentIndicator.
                        cursor.next();

                        take_signed_integer(&mut buf, cursor, &kind)?;
                    }
                    Some(Err(e)) => {
                        // todo!();
                    }
                    Some(Ok(_)) | None => {
                        // Finished lexing.
                        kind = NumericKind::Rational;
                    }
                }
            }
            Some(Ok('e')) | Some(Ok('E')) => {
                // Consume the ExponentIndicator.
                cursor.next();

                take_signed_integer(&mut buf, cursor, &kind)?;
            }
            Some(Err(e)) => {
                // todo!();
            }

            Some(Ok(_)) | None => {
                // Indicates lexing finished.
            }
        }

        // self.check_after_numeric_literal()?;

        let num = match kind {
                NumericKind::BigInt(base) => {
                    Numeric::BigInt(
                        BigInt::from_string_radix(&buf, base as u32).expect("Could not convert to BigInt")
                        )
                }
                NumericKind::Rational /* base: 10 */ => {
                    Numeric::Rational(
                        f64::from_str(&buf)
                            .map_err(|_| Error::syntax("Could not convert value to f64"))?,
                    )
                }
                NumericKind::Integer(base) => {
                    if let Ok(num) = i32::from_str_radix(&buf, base as u32) {
                        Numeric::Integer(
                            num
                        )
                    } else {
                        let b = f64::from(base);
                        let mut result = 0.0_f64;
                        for c in buf.chars() {
                            let digit = f64::from(c.to_digit(base as u32).unwrap());
                            result = result * b + digit;
                        }

                        Numeric::Rational(result)
                    }

                }
            };

        Ok(Token::new(
            TokenKind::NumericLiteral(num),
            Span::new(start_pos, cursor.pos()),
        ))
    }
}